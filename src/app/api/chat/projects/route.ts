import { NextResponse } from "next/server";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";

import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { buildProjectIndex, deleteAllProjectData } from "@/lib/memory-layer";

type ProjectDomain = "general" | "work" | "personal" | "business";
type ProjectStatus = "active" | "archived";

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
  domain: ProjectDomain;
  status: ProjectStatus;
  instruction: string;
  knowledge: string;
  uploadedFiles: UploadedFile[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};

type ProjectStore = {
  projects: ChatProject[];
};

const DATA_DIR = "/root/paho/data/web-chat";
const PROJECTS_PATH = path.join(DATA_DIR, "projects.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

export const runtime = "nodejs";

function nowIso() {
  return new Date().toISOString();
}

function makeId(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "project";
  return `${slug}-${Date.now().toString(36)}`;
}

function normalizeDomain(value: unknown): ProjectDomain {
  const raw = String(value || "general").toLowerCase();
  if (raw === "work" || raw === "personal" || raw === "business" || raw === "general") return raw;
  return "general";
}

function normalizeStatus(value: unknown): ProjectStatus {
  return String(value || "active").toLowerCase() === "archived" ? "archived" : "active";
}

function normalizeProject(project: Partial<ChatProject>): ChatProject {
  return {
    id: String(project.id || makeId(String(project.title || "project"))),
    title: String(project.title || "Untitled project"),
    domain: normalizeDomain(project.domain),
    status: normalizeStatus(project.status),
    instruction: String(project.instruction || ""),
    knowledge: String(project.knowledge || ""),
    uploadedFiles: Array.isArray(project.uploadedFiles) ? project.uploadedFiles : [],
    createdAt: String(project.createdAt || nowIso()),
    updatedAt: String(project.updatedAt || project.createdAt || nowIso()),
    archivedAt: project.archivedAt,
  };
}

async function readStore(): Promise<ProjectStore> {
  try {
    const raw = await readFile(PROJECTS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<ProjectStore>;
    return { projects: Array.isArray(parsed.projects) ? parsed.projects.map(normalizeProject) : [] };
  } catch {
    return { projects: [] };
  }
}

async function saveStore(store: ProjectStore) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(PROJECTS_PATH, JSON.stringify(store, null, 2), "utf8");
}

function cleanText(value: unknown, max = 30000) {
  return String(value || "").trim().slice(0, max);
}

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const url = new URL(req.url);
  const includeArchived = url.searchParams.get("includeArchived") === "true";
  const store = await readStore();
  const projects = includeArchived ? store.projects : store.projects.filter((project) => project.status !== "archived");
  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const title = cleanText(body?.title, 120);
  if (!title) return NextResponse.json({ error: "Nama project wajib diisi." }, { status: 400 });

  const store = await readStore();
  const timestamp = nowIso();
  const project: ChatProject = {
    id: makeId(title),
    title,
    domain: normalizeDomain(body?.domain),
    status: "active",
    instruction: cleanText(body?.instruction),
    knowledge: cleanText(body?.knowledge),
    uploadedFiles: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const next = { projects: [project, ...store.projects] };
  await saveStore(next);
  return NextResponse.json({ project, projects: next.projects });
}

export async function PUT(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const id = cleanText(body?.id, 160);
  if (!id) return NextResponse.json({ error: "Project id wajib diisi." }, { status: 400 });

  const store = await readStore();
  let found: ChatProject | null = null;
  const projects = store.projects.map((project) => {
    if (project.id !== id) return project;
    const nextStatus = body?.status === undefined ? project.status : normalizeStatus(body?.status);
    found = {
      ...project,
      title: cleanText(body?.title, 120) || project.title,
      domain: normalizeDomain(body?.domain ?? project.domain),
      status: nextStatus,
      archivedAt: nextStatus === "archived" ? project.archivedAt || nowIso() : undefined,
      instruction: cleanText(body?.instruction),
      knowledge: cleanText(body?.knowledge),
      updatedAt: nowIso(),
    };
    return found;
  });

  if (!found) return NextResponse.json({ error: "Project tidak ditemukan." }, { status: 404 });
  await saveStore({ projects });
  const savedProject = found as ChatProject;
  await buildProjectIndex(savedProject.id, {
    instruction: savedProject.instruction,
    knowledge: savedProject.knowledge,
    uploadedFiles: savedProject.uploadedFiles,
  }).catch(() => undefined);
  return NextResponse.json({ project: found, projects });
}

export async function DELETE(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const url = new URL(req.url);
  const id = cleanText(url.searchParams.get("id"), 160);
  if (!id) return NextResponse.json({ error: "Project id wajib diisi." }, { status: 400 });

  const store = await readStore();
  const target = store.projects.find((project) => project.id === id);
  if (!target) return NextResponse.json({ error: "Project tidak ditemukan." }, { status: 404 });

  const projects = store.projects.filter((project) => project.id !== id);
  await saveStore({ projects });
  await rm(path.join(UPLOAD_DIR, id), { recursive: true, force: true }).catch(() => undefined);
  await deleteAllProjectData(id).catch(() => undefined);
  return NextResponse.json({ ok: true, project: target, projects });
}
