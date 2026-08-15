import path from "path";
import { realpath, stat } from "fs/promises";

/**
 * Read-only file browser. Access is confined to an explicit allowlist of roots
 * so a compromised session cannot walk the whole filesystem (no /etc, no ~/.ssh,
 * no /root/.hermes where credentials live).
 */
export const ALLOWED_ROOTS: { id: string; label: string; path: string }[] = [
  { id: "paho", label: "Paho (source)", path: "/root/paho/src" },
  { id: "paho-data", label: "Paho (data)", path: "/root/paho/data" },
  { id: "vault", label: "Obsidian Vault", path: "/root/obsidian-vault" },
  { id: "cron", label: "Hermes Cron Output", path: "/root/.hermes/cron/output" },
];

/** Files that must never be served even inside an allowed root. */
const DENY_PATTERNS = [
  /(^|\/)\.env(\..*)?$/i,
  /(^|\/)\.git(\/|$)/,
  /(^|\/)node_modules(\/|$)/,
  /\.(pem|key|p12|pfx)$/i,
  /(^|\/)id_(rsa|ed25519|ecdsa)(\.pub)?$/,
  /(^|\/)auth\.db$/i,
  /\.(db|sqlite|sqlite3)(-wal|-shm)?$/i,
  /credential/i,
  /secret/i,
];

export const MAX_PREVIEW_BYTES = 512 * 1024;

export function isDenied(absolutePath: string) {
  return DENY_PATTERNS.some((pattern) => pattern.test(absolutePath));
}

/**
 * Resolves a requested path and proves it stays inside an allowed root even
 * after symlinks are followed. Returns null when the path escapes.
 */
export async function safeResolve(requested: string): Promise<{ absolute: string; root: string } | null> {
  const candidate = path.resolve(requested || "");
  for (const root of ALLOWED_ROOTS) {
    const rootReal = await realpath(root.path).catch(() => root.path);
    if (candidate !== rootReal && !candidate.startsWith(`${rootReal}${path.sep}`)) continue;

    // Follow symlinks before trusting the prefix check.
    const real = await realpath(candidate).catch(() => null);
    if (!real) return null;
    if (real !== rootReal && !real.startsWith(`${rootReal}${path.sep}`)) return null;
    if (isDenied(real)) return null;
    return { absolute: real, root: rootReal };
  }
  return null;
}

export async function entryKind(absolutePath: string) {
  const info = await stat(absolutePath);
  return { isDirectory: info.isDirectory(), size: info.size, modified: info.mtime.toISOString() };
}
