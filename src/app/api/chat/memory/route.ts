import { NextResponse } from "next/server";

import { getAuthSession, unauthorized } from "@/lib/api-auth";
import {
  buildProjectIndex,
  readIndex,
  readProjectMemory,
  saveProjectMemory,
} from "@/lib/memory-layer";
import type { ProjectMemory } from "@/lib/memory-layer";

export const runtime = "nodejs";

function cleanList(value: unknown, max = 40): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, max);
}

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const url = new URL(req.url);
  const projectId = String(url.searchParams.get("projectId") || "").trim();
  if (!projectId) return NextResponse.json({ error: "Project id wajib diisi." }, { status: 400 });

  const memory = await readProjectMemory(projectId);
  const index = await readIndex(projectId);

  return NextResponse.json({
    memory,
    index: index
      ? {
          chunkCount: index.chunks.length,
          totalTokensEstimate: index.chunks.reduce((sum, chunk) => sum + chunk.tokensEstimate, 0),
          sources: Array.from(new Set(index.chunks.map((chunk) => chunk.sourceId || chunk.sourceType))),
          updatedAt: index.updatedAt,
        }
      : null,
  });
}

export async function PUT(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId || "").trim();
  if (!projectId) return NextResponse.json({ error: "Project id wajib diisi." }, { status: 400 });

  const existing = await readProjectMemory(projectId);
  const memory: ProjectMemory = {
    ...existing,
    projectId,
    summary: body?.summary === undefined ? existing.summary : String(body.summary || "").trim().slice(0, 8000),
    facts: body?.facts === undefined ? existing.facts : cleanList(body.facts),
    decisions: body?.decisions === undefined ? existing.decisions : cleanList(body.decisions),
    todos: body?.todos === undefined ? existing.todos : cleanList(body.todos),
    preferences: body?.preferences === undefined ? existing.preferences : cleanList(body.preferences),
  };

  await saveProjectMemory(memory);
  return NextResponse.json({ ok: true, memory });
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId || "").trim();
  const action = String(body?.action || "").trim();
  if (!projectId) return NextResponse.json({ error: "Project id wajib diisi." }, { status: 400 });

  if (action === "reindex") {
    const instruction = String(body?.instruction || "");
    const knowledge = String(body?.knowledge || "");
    const uploadedFiles = Array.isArray(body?.uploadedFiles) ? body.uploadedFiles : [];
    const index = await buildProjectIndex(projectId, { instruction, knowledge, uploadedFiles });
    return NextResponse.json({
      ok: true,
      index: {
        chunkCount: index.chunks.length,
        totalTokensEstimate: index.chunks.reduce((sum, chunk) => sum + chunk.tokensEstimate, 0),
        updatedAt: index.updatedAt,
      },
    });
  }

  return NextResponse.json({ error: "Action tidak dikenal." }, { status: 400 });
}
