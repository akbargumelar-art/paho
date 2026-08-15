import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { buildProjectIndex } from "@/lib/memory-layer";

type UploadedFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  path: string;
  uploadedAt: string;
  extractedChars: number;
};

type ChatProject = {
  id: string;
  title: string;
  domain: "general" | "work" | "personal" | "business";
  status?: "active" | "archived";
  instruction: string;
  knowledge: string;
  uploadedFiles?: UploadedFile[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};

type ProjectStore = { projects: ChatProject[] };

const DATA_DIR = "/root/paho/data/web-chat";
const PROJECTS_PATH = path.join(DATA_DIR, "projects.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const execFileAsync = promisify(execFile);

export const runtime = "nodejs";

function safeName(value: string) {
  const cleaned = value
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 120);
  return cleaned || `file-${Date.now()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeProject(project: ChatProject): ChatProject {
  return {
    ...project,
    status: project.status === "archived" ? "archived" : "active",
    uploadedFiles: Array.isArray(project.uploadedFiles) ? project.uploadedFiles : [],
  };
}

async function readStore(): Promise<ProjectStore> {
  try {
    const raw = await readFile(PROJECTS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<ProjectStore>;
    return { projects: Array.isArray(parsed.projects) ? parsed.projects.map((item) => normalizeProject(item as ChatProject)) : [] };
  } catch {
    return { projects: [] };
  }
}

async function saveStore(store: ProjectStore) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(PROJECTS_PATH, JSON.stringify(store, null, 2), "utf8");
}

function isTextLike(filename: string, type: string) {
  const ext = path.extname(filename).toLowerCase();
  return (
    type.startsWith("text/") ||
    [".txt", ".md", ".markdown", ".csv", ".json", ".log", ".yaml", ".yml", ".xml", ".html", ".css", ".js", ".ts", ".tsx"].includes(ext)
  );
}

async function extractPdf(filePath: string) {
  try {
    const { stdout } = await execFileAsync("pdftotext", ["-layout", "-enc", "UTF-8", filePath, "-"], {
      timeout: 60_000,
      maxBuffer: 1024 * 1024 * 2,
    });
    return stdout.trim();
  } catch (error) {
    const err = error as Error;
    return `[PDF tersimpan, tetapi ekstraksi teks gagal: ${err.message}]`;
  }
}

async function extractImage(filePath: string) {
  try {
    const { stdout } = await execFileAsync("tesseract", [filePath, "stdout", "-l", "eng+ind"], {
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
    });
    return stdout.trim();
  } catch (error) {
    const err = error as Error;
    return `[OCR gambar belum berhasil: ${err.message}]`;
  }
}

async function extractContent(filePath: string, filename: string, type: string, buffer: Buffer) {
  const ext = path.extname(filename).toLowerCase();

  if (isTextLike(filename, type)) {
    return buffer.toString("utf8").replace(/\0/g, "").slice(0, 80_000).trim();
  }

  if (type === "application/pdf" || ext === ".pdf") {
    const text = await extractPdf(filePath);
    return text.slice(0, 80_000).trim() || "[PDF tersimpan, tetapi tidak ada text layer yang berhasil diekstrak.]";
  }

  if (type.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"].includes(ext)) {
    const text = await extractImage(filePath);
    return text.slice(0, 40_000).trim() || "[Gambar tersimpan, OCR tidak menemukan teks.]";
  }

  return "[File tersimpan, tetapi tipe ini belum bisa diekstrak otomatis. Tambahkan ringkasan manual ke knowledge jika perlu.]";
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const form = await req.formData();
    const projectId = String(form.get("projectId") || "");
    const file = form.get("file");

  if (!projectId) return NextResponse.json({ error: "Project id wajib diisi." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "File wajib diupload." }, { status: 400 });
  if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: "Ukuran file maksimal 12 MB." }, { status: 400 });

  const store = await readStore();
  const project = store.projects.find((item) => item.id === projectId);
  if (!project) return NextResponse.json({ error: "Project tidak ditemukan." }, { status: 404 });
  if (project.status === "archived") return NextResponse.json({ error: "Project sedang diarsipkan. Restore dulu sebelum upload file." }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const projectUploadDir = path.join(UPLOAD_DIR, projectId);
  await mkdir(projectUploadDir, { recursive: true });
  const timestamp = nowIso();
  const filename = `${Date.now()}-${safeName(file.name || "upload")}`;
  const filePath = path.join(projectUploadDir, filename);
  await writeFile(filePath, buffer);

  const extracted = await extractContent(filePath, file.name || filename, file.type || "application/octet-stream", buffer);
  const uploadedFile: UploadedFile = {
    id: filename,
    name: file.name || filename,
    type: file.type || "application/octet-stream",
    size: file.size,
    path: filePath,
    uploadedAt: timestamp,
    extractedChars: extracted.length,
  };
  const block = [
    "",
    `--- Uploaded context: ${uploadedFile.name}`,
    `Uploaded at: ${timestamp}`,
    `MIME: ${uploadedFile.type}`,
    `Size: ${uploadedFile.size} bytes`,
    `Path: ${filePath}`,
    "Extracted content:",
    extracted || "[Tidak ada teks yang berhasil diekstrak.]",
    "--- End uploaded context",
  ].join("\n");

  const projects = store.projects.map((item) =>
    item.id === projectId
      ? {
          ...item,
          uploadedFiles: [uploadedFile, ...(item.uploadedFiles || [])],
          knowledge: `${item.knowledge || ""}${block}`.slice(-120_000),
          updatedAt: timestamp,
        }
      : item
  );
  const updated = projects.find((item) => item.id === projectId)!;
  await saveStore({ projects });
  await buildProjectIndex(projectId, {
    instruction: updated.instruction,
    knowledge: updated.knowledge,
    uploadedFiles: updated.uploadedFiles,
  }).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      project: updated,
      file: uploadedFile,
    });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message || "Upload file gagal." }, { status: 500 });
  }
}
