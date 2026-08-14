import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

import { getAuthSession, unauthorized } from "@/lib/api-auth";

const execFileAsync = promisify(execFile);
const HERMES_BIN = process.env.PAHO_HERMES_BIN || "/root/.local/bin/hermes";
const HOME = "/root/.hermes";
const MANAGED_PROFILES = ["", "gadis", "priska", "bunga"];

export const runtime = "nodejs";

async function runHermes(args: string[], timeout = 30_000) {
  try {
    const { stdout, stderr } = await execFileAsync(HERMES_BIN, args, {
      timeout,
      maxBuffer: 1024 * 1024 * 2,
      env: { ...process.env, PATH: `/root/.nvm/versions/node/v24.19.0/bin:${process.env.PATH || ""}` },
    });
    return (stdout || stderr || "").trim();
  } catch (error) {
    const err = error as Error & { stdout?: string; stderr?: string };
    return (err.stdout || err.stderr || err.message || "").trim();
  }
}

async function readMemory(profile?: string) {
  const file = profile ? `${HOME}/profiles/${profile}/memories/MEMORY.md` : `${HOME}/memories/MEMORY.md`;
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}

function safeSkillName(value: string) {
  const base = value
    .replace(/\.md$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return base || `uploaded-skill-${Date.now().toString(36)}`;
}

function extractFrontmatterName(markdown: string) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  const body = match?.[1] || "";
  const name = body.match(/^name:\s*["']?([^"'\n]+)["']?\s*$/m)?.[1]?.trim();
  return name ? safeSkillName(name) : "";
}

function ensureSkillMarkdown(markdown: string, skillName: string, filename: string) {
  const trimmed = markdown.trim();
  if (/^---\n[\s\S]*?\n---/.test(trimmed)) return `${trimmed}\n`;
  const title = trimmed.match(/^#\s+(.+)$/m)?.[1]?.trim() || filename.replace(/\.md$/i, "");
  return [
    "---",
    `name: ${skillName}`,
    `description: Use when working with ${title}. Uploaded from Paho Hermes Manager.`,
    "version: 1.0.0",
    "---",
    "",
    trimmed,
    "",
  ].join("\n");
}

async function handleSkillUpload(req: Request) {
  const form = await req.formData();
  const profile = String(form.get("profile") || "").trim();
  const file = form.get("file");
  const requestedName = String(form.get("name") || "").trim();

  if (!(file instanceof File)) return NextResponse.json({ error: "File .md wajib diupload." }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".md")) return NextResponse.json({ error: "File harus berformat .md." }, { status: 400 });
  if (file.size > 512 * 1024) return NextResponse.json({ error: "Ukuran skill maksimal 512 KB." }, { status: 400 });

  const markdown = Buffer.from(await file.arrayBuffer()).toString("utf8").replace(/\0/g, "");
  const skillName = safeSkillName(requestedName) || extractFrontmatterName(markdown) || safeSkillName(file.name);
  const content = ensureSkillMarkdown(markdown, skillName, file.name);
  const profiles = profile === "__all__" ? MANAGED_PROFILES : [profile];
  const written: string[] = [];

  for (const item of profiles) {
    const skillRoot = item ? path.join(HOME, "profiles", item, "skills") : path.join(HOME, "skills");
    const skillDir = path.join(skillRoot, skillName);
    const targetPath = path.join(skillDir, "SKILL.md");
    await mkdir(skillDir, { recursive: true });
    await writeFile(targetPath, content, "utf8");
    written.push(`${item || "default"}: ${targetPath}`);
  }

  return NextResponse.json({ ok: true, action: "skill-upload-md", profile: profile === "__all__" ? "all" : profile || "default", skillName, paths: written, output: `Skill ${skillName} berhasil diupload:\n${written.join("\n")}` });
}

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const url = new URL(req.url);
  const profile = url.searchParams.get("profile") || "";
  const [skills, plugins, mcp, memoryStatus, memory] = await Promise.all([
    runHermes([...(profile ? ["--profile", profile] : []), "skills", "list"]),
    runHermes([...(profile ? ["--profile", profile] : []), "plugins", "list"]),
    runHermes([...(profile ? ["--profile", profile] : []), "mcp", "list"]),
    runHermes([...(profile ? ["--profile", profile] : []), "memory", "status"]),
    readMemory(profile || undefined),
  ]);

  return NextResponse.json({ profile: profile || "default", skills, plugins, mcp, memoryStatus, memory });
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) return handleSkillUpload(req);

  const body = await req.json().catch(() => ({}));
  const profile = String(body?.profile || "").trim();
  const action = String(body?.action || "").trim();
  const target = String(body?.target || "").trim();
  if (!target || target.length > 500) return NextResponse.json({ error: "Target wajib diisi." }, { status: 400 });

  const profiles = profile === "__all__" ? MANAGED_PROFILES : [profile];
  const outputs: string[] = [];

  for (const item of profiles) {
    const prefix = item ? ["--profile", item] : [];
    let args: string[];
    if (action === "skill-install") args = [...prefix, "skills", "install", target];
    else if (action === "plugin-install") args = [...prefix, "plugins", "install", target];
    else if (action === "skill-uninstall") args = [...prefix, "skills", "uninstall", target];
    else if (action === "plugin-remove") args = [...prefix, "plugins", "remove", target];
    else if (action === "mcp-test") args = [...prefix, "mcp", "test", target];
    else return NextResponse.json({ error: "Action tidak diizinkan." }, { status: 400 });

    const output = await runHermes(args, 120_000);
    outputs.push(`## ${item || "default"}\n${output || "Selesai."}`);
  }

  return NextResponse.json({ ok: true, action, target, output: outputs.join("\n\n") });
}
