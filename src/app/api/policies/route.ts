import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-auth";

// ============================================================
// ASSISTANT FILES — Live Source Adapter + API Route
// Membaca blueprint/policy docs dari /root/assistant/ di VPS
// ============================================================

const ASSISTANT_ROOT = process.env.ASSISTANT_ROOT || "";

type AssistantDoc = {
  filename: string;
  title: string;
  content: string;
  modified_at: string;
  size_bytes: number;
  domain?: string;
};

const READABLE_EXTENSIONS = [".md", ".txt", ".yaml", ".yml", ".json"];

async function listAssistantDocs(subdir = ""): Promise<AssistantDoc[]> {
  if (!ASSISTANT_ROOT) return [];
  const dir = subdir ? path.join(ASSISTANT_ROOT, subdir) : ASSISTANT_ROOT;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const docs: AssistantDoc[] = [];
    for (const entry of entries) {
      if (entry.isFile() && READABLE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
        const filePath = path.join(dir, entry.name);
        try {
          const content = await fs.readFile(filePath, "utf-8");
          const stat = await fs.stat(filePath);
          docs.push({
            filename: entry.name,
            title: entry.name.replace(/\.[^.]+$/, "").replace(/_/g, " "),
            content: content.slice(0, 5000), // batas preview 5KB
            modified_at: stat.mtime.toISOString(),
            size_bytes: stat.size,
            domain: subdir || "shared",
          });
        } catch {
          // skip unreadable
        }
      }
    }
    return docs.sort((a, b) => b.modified_at.localeCompare(a.modified_at));
  } catch {
    return [];
  }
}

// GET /api/policies — baca docs dari /root/assistant/
export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const url = new URL(req.url);
    const domain = url.searchParams.get("domain") || "";

    // Baca dari root level + subdirs yang relevan
    const [rootDocs, sharedDocs, domainDocs] = await Promise.allSettled([
      listAssistantDocs(""),
      listAssistantDocs("shared"),
      domain ? listAssistantDocs(domain) : Promise.resolve([]),
    ]);

    const root = rootDocs.status === "fulfilled" ? rootDocs.value : [];
    const shared = sharedDocs.status === "fulfilled" ? sharedDocs.value : [];
    const domainFiles = domainDocs.status === "fulfilled" ? domainDocs.value : [];

    const all = [...root, ...shared, ...domainFiles];

    // Jika tidak ada file live (dev mode), return DB fallback message
    if (all.length === 0) {
      return NextResponse.json({
        docs: [],
        isLive: false,
        message: "No assistant files found. ASSISTANT_ROOT not configured or empty.",
      });
    }

    return NextResponse.json({
      docs: all,
      isLive: true,
      total: all.length,
    });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/policies — update satu doc file
export async function PATCH(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    if (!ASSISTANT_ROOT) {
      return NextResponse.json({ error: "ASSISTANT_ROOT not configured" }, { status: 503 });
    }

    const { filename, content, subdir } = (await req.json()) as {
      filename: string;
      content: string;
      subdir?: string;
    };

    if (!filename || content === undefined) {
      return NextResponse.json({ error: "filename and content required" }, { status: 400 });
    }

    // Safety: hanya izinkan extension yang diketahui, cegah path traversal
    const ext = path.extname(filename);
    if (!READABLE_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
    }
    const safeFilename = path.basename(filename); // strip path traversal
    const targetDir = subdir ? path.join(ASSISTANT_ROOT, subdir) : ASSISTANT_ROOT;
    const targetPath = path.join(targetDir, safeFilename);

    // Pastikan masih dalam ASSISTANT_ROOT
    if (!targetPath.startsWith(ASSISTANT_ROOT)) {
      return NextResponse.json({ error: "Path traversal not allowed" }, { status: 400 });
    }

    await fs.writeFile(targetPath, content, "utf-8");
    return NextResponse.json({ success: true, path: targetPath });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
