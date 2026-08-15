import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { classify, readHealth, saveHealth, type ModelHealth } from "@/lib/model-health";

export const runtime = "nodejs";
// A probe of several models can legitimately take a while.
export const maxDuration = 300;

const ROUTER_BASE = process.env.PAHO_ROUTER_BASE || "http://localhost:20128/v1";
const PROBE_TIMEOUT_MS = 45_000;
const HERMES_CONFIG = "/root/.hermes/config.yaml";

/**
 * The router requires the same key Hermes uses. Read it server-side only; it is
 * never returned to the browser.
 */
async function routerKey(): Promise<string> {
  try {
    const raw = await readFile(HERMES_CONFIG, "utf8");
    const match = raw.match(/^\s*api_key:\s*(\S+)\s*$/m);
    return match ? match[1].replace(/^["']|["']$/g, "") : "";
  } catch {
    return "";
  }
}

/**
 * Probes a model through the router's OpenAI-compatible chat endpoint. This is
 * a real request (tiny prompt, 8 token cap) so the result reflects whether the
 * model actually answers — not just whether it is listed.
 */
async function probe(model: string, key: string): Promise<ModelHealth> {
  const startedAt = Date.now();
  try {
    const res = await fetch(`${ROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 8,
        stream: false,
      }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const latencyMs = Date.now() - startedAt;
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        model,
        status: "failed",
        latencyMs,
        checkedAt: new Date().toISOString(),
        note: `HTTP ${res.status}${body ? `: ${body.slice(0, 120)}` : ""}`,
      };
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = String(data.choices?.[0]?.message?.content ?? "").trim();
    if (!text) {
      return { model, status: "failed", latencyMs, checkedAt: new Date().toISOString(), note: "Balasan kosong" };
    }
    return { model, status: classify(latencyMs), latencyMs, checkedAt: new Date().toISOString() };
  } catch (error) {
    return {
      model,
      status: "failed",
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      note: (error as Error).name === "TimeoutError" ? `Timeout > ${PROBE_TIMEOUT_MS / 1000}s` : (error as Error).message,
    };
  }
}

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();
  const store = await readHealth();
  return NextResponse.json({ models: store.models, probeTimeoutMs: PROBE_TIMEOUT_MS });
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const requested = Array.isArray(body?.models) ? body.models : [];
  const models = requested
    .map((value: unknown) => String(value || "").trim())
    .filter((value: string) => /^[A-Za-z0-9._\/-]{1,80}$/.test(value))
    .slice(0, 12);

  if (models.length === 0) {
    return NextResponse.json({ error: "Tidak ada model valid untuk dicek." }, { status: 400 });
  }

  // Sequential on purpose: parallel probes would distort latency measurements
  // and can overload the local router.
  const store = await readHealth();
  const key = await routerKey();
  const results: ModelHealth[] = [];
  for (const model of models) {
    const result = await probe(model, key);
    store.models[model] = result;
    results.push(result);
  }
  await saveHealth(store);

  return NextResponse.json({ results, models: store.models });
}
