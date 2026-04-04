import { NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { getHermesLogs } from "@/lib/live-sources/hermes-memories";
import { getOpenClawLogs } from "@/lib/live-sources/openclaw-files";

export type UnifiedLogEntry = {
  id: string;
  source: "Hermes" | "OpenClaw";
  level: "INFO" | "WARN" | "ERROR" | "CRITICAL";
  message: string;
  timestamp: string;
  raw?: string;
};

function parseLogLine(raw: string, source: "Hermes" | "OpenClaw"): UnifiedLogEntry | null {
  raw = raw.trim();
  if (!raw) return null;

  // Coba parse sebagai JSON dulu (JSONL format)
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    return {
      id: `${source}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      source,
      level: (String(obj.level ?? obj.severity ?? "INFO").toUpperCase()) as UnifiedLogEntry["level"],
      message: String(obj.message ?? obj.msg ?? obj.text ?? raw),
      timestamp: String(obj.timestamp ?? obj.time ?? obj.created_at ?? new Date().toISOString()),
      raw,
    };
  } catch {
    // Plain text log — coba detect level dari konten
    const upper = raw.toUpperCase();
    const level: UnifiedLogEntry["level"] =
      upper.includes("ERROR") || upper.includes("FAIL") ? "ERROR"
      : upper.includes("WARN") ? "WARN"
      : upper.includes("CRITICAL") ? "CRITICAL"
      : "INFO";

    return {
      id: `${source}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      source,
      level,
      message: raw,
      timestamp: new Date().toISOString(),
      raw,
    };
  }
}

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  try {
    // Ambil logs dari kedua sumber secara paralel
    const [hermesResult, openClawResult] = await Promise.allSettled([
      getHermesLogs(100),
      getOpenClawLogs(50),
    ]);

    const hermesRaw = hermesResult.status === "fulfilled" ? hermesResult.value : [];
    const openClawRaw = openClawResult.status === "fulfilled" ? openClawResult.value : [];

    // Parse ke unified format
    const hermesLogs: UnifiedLogEntry[] = hermesRaw
      .map((entry) => parseLogLine(entry.line, "Hermes"))
      .filter(Boolean) as UnifiedLogEntry[];

    const openClawLogs: UnifiedLogEntry[] = openClawRaw
      .map((line) => parseLogLine(line, "OpenClaw"))
      .filter(Boolean) as UnifiedLogEntry[];

    // Merge dan sort by timestamp desc
    const all = [...hermesLogs, ...openClawLogs].sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // Fallback: kalau VPS tidak terkonfigurasi, kembalikan array kosong dengan status
    return NextResponse.json({
      logs: all.slice(0, 150),
      total: all.length,
      sources: {
        hermes: hermesLogs.length,
        openclaw: openClawLogs.length,
      },
      isLive: hermesLogs.length > 0 || openClawLogs.length > 0,
    });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
