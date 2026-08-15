import { NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";

// 9Router exposes an OpenAI-compatible /models list; Paho reads it so the model
// picker always reflects what the gateway can actually serve.
const ROUTER_URL = process.env.PAHO_ROUTER_URL || "http://localhost:20128/v1/models";

// Curated shortlist shown first — the models Abay actually reaches for.
const FEATURED = [
  "hermes",
  "cc/claude-sonnet-5",
  "cc/claude-opus-5",
  "amanai/amanai/gpt-5.6-sol",
  "amanai/amanai/glm-5.2",
  "amanai/amanai/kimi-k3",
  "amanai/amanai/grok-4.5",
  "amanai/amanai/deepseek-v4-pro",
];

function familyOf(id: string): string {
  const name = id.toLowerCase();
  if (name === "hermes") return "Hermes";
  if (name.includes("claude")) return "Claude";
  if (name.includes("gpt") || name.includes("codex")) return "GPT / Codex";
  if (name.includes("glm")) return "GLM";
  if (name.includes("kimi")) return "Kimi";
  if (name.includes("qwen")) return "Qwen";
  if (name.includes("deepseek")) return "DeepSeek";
  if (name.includes("grok")) return "Grok";
  if (name.includes("minimax")) return "MiniMax";
  return "Lainnya";
}

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  try {
    const res = await fetch(ROUTER_URL, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Router menjawab ${res.status}`);
    const data = (await res.json()) as { data?: Array<{ id?: string }> };

    const seen = new Set<string>();
    const ids: string[] = [];
    for (const item of data.data || []) {
      const id = String(item.id || "").trim();
      // The router lists some ids twice under different prefixes; dedupe.
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }

    const featured = FEATURED.filter((id) => seen.has(id));
    const models = ids.map((id) => ({ id, family: familyOf(id), featured: featured.includes(id) }));

    return NextResponse.json({ models, featured, total: models.length, default: "hermes" });
  } catch (error) {
    // Never blank the picker: fall back to the known-good default.
    return NextResponse.json({
      models: [{ id: "hermes", family: "Hermes", featured: true }],
      featured: ["hermes"],
      total: 1,
      default: "hermes",
      error: (error as Error).message,
    });
  }
}
