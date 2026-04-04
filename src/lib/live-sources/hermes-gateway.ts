import fs from "fs/promises";
import path from "path";

// ============================================================
// HERMES GATEWAY — Live Source Adapter
// Membaca langsung dari /root/.hermes/gateway_state.json
// dan /root/.hermes/processes.json di VPS
// ============================================================

const HERMES_GATEWAY_STATE = process.env.HERMES_GATEWAY_STATE || "";
const HERMES_PROCESSES = process.env.HERMES_PROCESSES || "";

export type PlatformState = {
  state: "connected" | "fatal" | "disconnected" | "unknown";
  updated_at: string;
  error_code?: string;
  error_message?: string;
};

export type HermesGatewayState = {
  pid: number;
  kind: string;
  gateway_state: "running" | "stopped" | "error";
  exit_reason: string | null;
  start_time: number;
  updated_at: string;
  platforms: {
    telegram?: PlatformState;
    whatsapp?: PlatformState;
    [key: string]: PlatformState | undefined;
  };
};

export type HermesProcess = {
  pid: number;
  name: string;
  status: string;
  started_at?: string;
};

/** Baca status live Hermes gateway dari gateway_state.json */
export async function getHermesGatewayState(): Promise<HermesGatewayState | null> {
  if (!HERMES_GATEWAY_STATE) return null;
  try {
    const raw = await fs.readFile(HERMES_GATEWAY_STATE, "utf-8");
    return JSON.parse(raw) as HermesGatewayState;
  } catch {
    return null;
  }
}

/** Baca daftar proses Hermes yang sedang berjalan dari processes.json */
export async function getHermesProcesses(): Promise<HermesProcess[]> {
  if (!HERMES_PROCESSES) return [];
  try {
    const raw = await fs.readFile(HERMES_PROCESSES, "utf-8");
    const data = JSON.parse(raw);
    // Format bisa array atau object — normalize ke array
    if (Array.isArray(data)) return data as HermesProcess[];
    if (data && typeof data === "object") return [data as HermesProcess];
    return [];
  } catch {
    return [];
  }
}

/** Helper: apakah file VPS bisa diakses (cek kita di VPS atau dev) */
export function isVpsEnvironment(): boolean {
  return !!HERMES_GATEWAY_STATE;
}

/** Format uptime dari start_time (Unix timestamp seconds) */
export function formatUptime(startTime: number): string {
  const uptimeMs = Date.now() - startTime * 1000;
  const hours = Math.floor(uptimeMs / 3600000);
  const minutes = Math.floor((uptimeMs % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Hitung session log files dari /root/.hermes/sessions/ */
export async function countHermesSessions(): Promise<number> {
  const sessionsDir = process.env.HERMES_SESSIONS_DIR || "";
  if (!sessionsDir) return 0;
  try {
    const files = await fs.readdir(sessionsDir);
    return files.filter((f) => f.endsWith(".jsonl")).length;
  } catch {
    return 0;
  }
}

/** Baca N session files terbaru (filename saja, sorted desc by name) */
export async function getRecentSessionFiles(limit = 10): Promise<string[]> {
  const sessionsDir = process.env.HERMES_SESSIONS_DIR || "";
  if (!sessionsDir) return [];
  try {
    const files = await fs.readdir(sessionsDir);
    return files
      .filter((f) => f.endsWith(".jsonl"))
      .sort()
      .reverse()
      .slice(0, limit)
      .map((f) => path.join(sessionsDir, f));
  } catch {
    return [];
  }
}

/** Baca semua entries dari satu session JSONL file */
export async function readSessionFile(
  filePath: string
): Promise<Record<string, unknown>[]> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return raw
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => {
        try {
          return JSON.parse(l) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as Record<string, unknown>[];
  } catch {
    return [];
  }
}
