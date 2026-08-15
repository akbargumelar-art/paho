import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type ChatAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  path: string;
  createdAt: string;
};

type Manifest = { attachments: ChatAttachment[] };

const DATA_DIR = "/root/paho/data/web-chat";
const ATTACHMENTS_DIR = path.join(DATA_DIR, "attachments");
const MANIFEST_PATH = path.join(DATA_DIR, "attachments.json");

function nowIso() { return new Date().toISOString(); }
function makeId() { return `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
function safePart(value: string) { return String(value || "").toLowerCase().replace(/[^a-z0-9_.-]+/g, "-").slice(0, 80) || "general"; }
function safeFilename(value: string) {
  const cleaned = String(value || "file.txt").trim().replace(/^['"]|['"]$/g, "").replace(/[\\/]/g, "-").replace(/[^\w.() -]+/g, "-").slice(0, 120);
  return cleaned.includes(".") ? cleaned : `${cleaned || "file"}.txt`;
}
function mimeFromName(name: string) {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "md") return "text/markdown; charset=utf-8";
  if (ext === "html") return "text/html; charset=utf-8";
  if (ext === "json") return "application/json; charset=utf-8";
  if (ext === "csv") return "text/csv; charset=utf-8";
  if (ext === "pdf") return "application/pdf";
  return "text/plain; charset=utf-8";
}

async function readManifest(): Promise<Manifest> {
  try {
    const raw = await readFile(MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<Manifest>;
    return { attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [] };
  } catch {
    return { attachments: [] };
  }
}

async function saveManifest(manifest: Manifest) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(MANIFEST_PATH, JSON.stringify({ attachments: manifest.attachments.slice(-1000) }, null, 2), "utf8");
}

export async function getChatAttachment(id: string): Promise<ChatAttachment | null> {
  const manifest = await readManifest();
  return manifest.attachments.find((item) => item.id === id) || null;
}

type ParsedBlock = { filename: string; body: string; raw: string };

const OPEN_RE = /^(`{3,})\s*(?:file|download|attachment)\s*[:=]?\s*([^\n`]+?)\s*$/i;

/**
 * Fence-aware parser for ```file: blocks.
 *
 * A markdown attachment normally CONTAINS fenced code blocks of its own, so a
 * lazy `[\s\S]*?```` match truncates the file at its first inner fence. Rules:
 *  - opening fence with 4+ backticks closes on the first fence of equal/greater
 *    length (unambiguous, preferred),
 *  - opening fence with exactly 3 backticks closes on the LAST fence line before
 *    the next file block (or end of message), because inner fences always pair up.
 */
export function parseFileBlocks(reply: string): ParsedBlock[] {
  const lines = String(reply || "").split("\n");
  const blocks: ParsedBlock[] = [];

  const openIdx: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (OPEN_RE.test(lines[i])) openIdx.push(i);
  }
  if (!openIdx.length) return blocks;

  for (let n = 0; n < openIdx.length; n += 1) {
    const start = openIdx[n];
    const match = lines[start].match(OPEN_RE);
    if (!match) continue;
    const ticks = match[1].length;
    const filename = match[2];
    const limit = n + 1 < openIdx.length ? openIdx[n + 1] : lines.length;

    let close = -1;
    if (ticks >= 4) {
      for (let i = start + 1; i < limit; i += 1) {
        const fence = lines[i].match(/^(`{3,})\s*$/);
        if (fence && fence[1].length >= ticks) { close = i; break; }
      }
    } else {
      for (let i = limit - 1; i > start; i -= 1) {
        if (/^`{3,}\s*$/.test(lines[i])) { close = i; break; }
      }
    }
    if (close === -1) close = limit;

    const body = lines.slice(start + 1, close).join("\n").replace(/^\n+|\n+$/g, "");
    const raw = lines.slice(start, Math.min(close + 1, lines.length)).join("\n");
    if (body.trim()) blocks.push({ filename, body, raw });
  }

  return blocks;
}

export async function extractAndSaveChatAttachments(reply: string, meta: { projectId: string; threadId: string }) {
  const attachments: ChatAttachment[] = [];
  const blocks = parseFileBlocks(reply);
  if (!blocks.length) return { content: reply, attachments };

  const manifest = await readManifest();
  const dir = path.join(ATTACHMENTS_DIR, safePart(meta.projectId), safePart(meta.threadId));
  let content = reply;

  await mkdir(dir, { recursive: true });
  for (const block of blocks) {
    const filename = safeFilename(block.filename);
    const body = block.body;
    const id = makeId();
    const storedName = `${Date.now()}-${filename}`;
    const filePath = path.join(dir, storedName);
    await writeFile(filePath, body, "utf8");
    const attachment: ChatAttachment = {
      id,
      name: filename,
      type: mimeFromName(filename),
      size: Buffer.byteLength(body, "utf8"),
      path: filePath,
      createdAt: nowIso(),
    };
    attachments.push(attachment);
    manifest.attachments.push(attachment);
    content = content.replace(block.raw, `\n[File terlampir: ${filename}]\n`);
  }

  if (attachments.length) await saveManifest(manifest);
  return { content: content.trim(), attachments };
}
