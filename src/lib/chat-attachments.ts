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

export async function extractAndSaveChatAttachments(reply: string, meta: { projectId: string; threadId: string }) {
  const attachments: ChatAttachment[] = [];
  const manifest = await readManifest();
  const dir = path.join(ATTACHMENTS_DIR, safePart(meta.projectId), safePart(meta.threadId));
  let content = reply;

  const fileBlock = /```(?:file|download|attachment)\s*[:=]?\s*([^\n`]+)\n([\s\S]*?)```/gi;
  const matches = Array.from(reply.matchAll(fileBlock));
  if (!matches.length) return { content: reply, attachments };

  await mkdir(dir, { recursive: true });
  for (const match of matches) {
    const filename = safeFilename(match[1]);
    const body = String(match[2] || "").replace(/^\n+|\n+$/g, "");
    if (!body.trim()) continue;
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
    content = content.replace(match[0], `\n[File terlampir: ${filename}]\n`);
  }

  if (attachments.length) await saveManifest(manifest);
  return { content: content.trim(), attachments };
}
