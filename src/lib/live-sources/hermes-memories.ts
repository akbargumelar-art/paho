import fs from "fs/promises";
import path from "path";

// ============================================================
// HERMES MEMORIES — Live Source Adapter
// Membaca dari /root/.hermes/memories/
//
// Struktur aktual di VPS:
//   memories/
//     MEMORY.md      ← context memory utama Hermes
//     MEMORY.md.lock
//     USER.md        ← profil user
//     USER.md.lock
//     tasks          ← file tunggal (bukan direktori) berisi tasks Hermes
//     reminders      ← file tunggal berisi reminders Hermes
//     projects       ← file tunggal berisi projects Hermes
//     archive/       ← direktori arsip
//
// CATATAN ARSITEKTUR:
//   Tasks/Reminders yang DIKELOLA via Paho UI tetap di aspri.db (Paho-authoritative).
//   File tasks/reminders di memories/ ini adalah milik Hermes natively — read-only view.
// ============================================================

const HERMES_MEMORIES_DIR = process.env.HERMES_MEMORIES_DIR || "";

export type MemoryFileContent = {
  filename: string;
  content: string;
  type: "file" | "directory";
  modified_at?: string;
};

/** Cek apakah path adalah file atau direktori */
async function getPathType(filePath: string): Promise<"file" | "directory" | "not_found"> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isDirectory() ? "directory" : "file";
  } catch {
    return "not_found";
  }
}

/** Baca satu file dari memories dir (bisa file biasa tanpa ekstensi) */
async function readMemoryEntry(name: string): Promise<MemoryFileContent | null> {
  if (!HERMES_MEMORIES_DIR) return null;
  const filePath = path.join(HERMES_MEMORIES_DIR, name);
  const type = await getPathType(filePath);

  if (type === "not_found") return null;

  if (type === "file") {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const stat = await fs.stat(filePath);
      return { filename: name, content, type: "file", modified_at: stat.mtime.toISOString() };
    } catch {
      return null;
    }
  }

  if (type === "directory") {
    // Direktori: list dan baca semua file di dalamnya
    try {
      const files = await fs.readdir(filePath);
      const readable = files.filter((f) => !f.endsWith(".lock"));
      const parts: string[] = [];
      for (const f of readable) {
        try {
          const content = await fs.readFile(path.join(filePath, f), "utf-8");
          parts.push(`=== ${f} ===\n${content}`);
        } catch {
          // skip
        }
      }
      return { filename: name, content: parts.join("\n\n"), type: "directory" };
    } catch {
      return null;
    }
  }

  return null;
}

// ---- PUBLIC READ FUNCTIONS ----

/** Baca MEMORY.md — context memory utama Hermes */
export async function getHermesMemory(): Promise<string | null> {
  const result = await readMemoryEntry("MEMORY.md");
  return result?.content ?? null;
}

/** Baca USER.md — profil user yang dikenali Hermes */
export async function getHermesUserProfile(): Promise<string | null> {
  const result = await readMemoryEntry("USER.md");
  return result?.content ?? null;
}

/** Baca konten file `tasks` milik Hermes (read-only dari Paho) */
export async function getHermesTasks(): Promise<MemoryFileContent | null> {
  return readMemoryEntry("tasks");
}

/** Baca konten file `reminders` milik Hermes (read-only dari Paho) */
export async function getHermesRemindersMemory(): Promise<MemoryFileContent | null> {
  return readMemoryEntry("reminders");
}

/** Baca konten file `projects` milik Hermes */
export async function getHermesProjectsMemory(): Promise<MemoryFileContent | null> {
  return readMemoryEntry("projects");
}

/** Tulis ke file tasks milik Hermes (controlled write) */
export async function writeHermesTasksFile(content: string): Promise<void> {
  if (!HERMES_MEMORIES_DIR) throw new Error("HERMES_MEMORIES_DIR not configured");
  const filePath = path.join(HERMES_MEMORIES_DIR, "tasks");
  await fs.writeFile(filePath, content, "utf-8");
}

/** Tulis ke file reminders milik Hermes (controlled write) */
export async function writeHermesRemindersFile(content: string): Promise<void> {
  if (!HERMES_MEMORIES_DIR) throw new Error("HERMES_MEMORIES_DIR not configured");
  const filePath = path.join(HERMES_MEMORIES_DIR, "reminders");
  await fs.writeFile(filePath, content, "utf-8");
}

// ---- LOGS ----

/** Baca log files dari HERMES_LOGS_DIR */
export async function getHermesLogs(limit = 100): Promise<{ source: string; line: string }[]> {
  const logsDir = process.env.HERMES_LOGS_DIR || "";
  if (!logsDir) return [];
  try {
    const files = await fs.readdir(logsDir);
    const logFiles = files
      .filter((f) => f.endsWith(".log") || f.endsWith(".jsonl") || f.endsWith(".txt"))
      .sort()
      .reverse()
      .slice(0, 5);

    const results: { source: string; line: string }[] = [];
    for (const f of logFiles) {
      const raw = await fs.readFile(path.join(logsDir, f), "utf-8");
      const lines = raw.split("\n").filter((l) => l.trim()).reverse();
      for (const line of lines) {
        results.push({ source: f, line });
        if (results.length >= limit) break;
      }
      if (results.length >= limit) break;
    }
    return results;
  } catch {
    return [];
  }
}
