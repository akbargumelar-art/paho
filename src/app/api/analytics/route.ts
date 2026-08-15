import { NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { getAuthSession, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";

const THREAD_DIR = "/root/paho/data/web-chat/threads";

type StoredMessage = {
  id?: string;
  role?: "user" | "assistant";
  content?: string;
  createdAt?: string;
  model?: string;
  error?: boolean;
};

type Day = { date: string; messages: number; chars: number; estimatedTokens: number };
type ModelRow = { model: string; responses: number; chars: number; estimatedTokens: number; share: number };

function dayKey(value?: string) {
  const date = value ? new Date(value) : new Date(NaN);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

// A transparent rough estimate only. Provider-billed usage is not exposed by
// the current Hermes CLI call, so Paho must not present this as exact billing.
function estimateTokens(chars: number) {
  return Math.max(0, Math.round(chars / 4));
}

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const now = new Date();
  const days = new Map<string, Day>();
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    days.set(date, { date, messages: 0, chars: 0, estimatedTokens: 0 });
  }

  const models = new Map<string, Omit<ModelRow, "share">>();
  let threadCount = 0;
  let userMessages = 0;
  let assistantMessages = 0;
  let totalChars = 0;
  let errors = 0;
  let oldest: string | null = null;
  let newest: string | null = null;

  try {
    const files = (await readdir(THREAD_DIR)).filter((name) => name.endsWith(".json"));
    for (const file of files) {
      try {
        const parsed = JSON.parse(await readFile(path.join(THREAD_DIR, file), "utf8")) as { messages?: StoredMessage[] };
        const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
        if (messages.length > 0) threadCount += 1;

        for (const message of messages) {
          const chars = String(message.content || "").length;
          totalChars += chars;
          if (message.role === "user") userMessages += 1;
          if (message.role === "assistant") {
            assistantMessages += 1;
            const model = message.model || "legacy / tidak tercatat";
            const row = models.get(model) || { model, responses: 0, chars: 0, estimatedTokens: 0 };
            row.responses += 1;
            row.chars += chars;
            row.estimatedTokens = estimateTokens(row.chars);
            models.set(model, row);
          }
          if (message.error) errors += 1;

          const date = dayKey(message.createdAt);
          if (date) {
            if (!oldest || date < oldest) oldest = date;
            if (!newest || date > newest) newest = date;
            const day = days.get(date);
            if (day) {
              day.messages += 1;
              day.chars += chars;
              day.estimatedTokens = estimateTokens(day.chars);
            }
          }
        }
      } catch {
        // One malformed legacy thread must not blank the analytics dashboard.
      }
    }
  } catch {
    // No threads yet is a valid empty state.
  }

  const modelRows: ModelRow[] = [...models.values()]
    .sort((a, b) => b.responses - a.responses)
    .map((row) => ({ ...row, share: assistantMessages ? Math.round((row.responses / assistantMessages) * 1000) / 10 : 0 }));

  return NextResponse.json({
    summary: {
      threads: threadCount,
      messages: userMessages + assistantMessages,
      userMessages,
      assistantMessages,
      errors,
      totalChars,
      estimatedTokens: estimateTokens(totalChars),
      oldest,
      newest,
    },
    models: modelRows,
    days: [...days.values()],
    methodology: "Estimasi token = karakter / 4. Bukan usage billing provider.",
    costAvailable: false,
  });
}
