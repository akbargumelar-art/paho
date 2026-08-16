import { NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

// Batasi akses hanya di bawah /root (atau spesifik project)
const ALLOWED_ROOT = "/root";

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(req.url);
  const targetPath = searchParams.get("path") || "/root/paho";
  
  // Keamanan: pastikan tidak bisa keluar dari ALLOWED_ROOT
  const absolutePath = path.resolve(targetPath);
  if (!absolutePath.startsWith(ALLOWED_ROOT)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const stats = await fs.stat(absolutePath);
    
    if (stats.isDirectory()) {
      const entries = await fs.readdir(absolutePath, { withFileTypes: true });
      const items = entries.map(ent => ({
        name: ent.name,
        path: path.join(absolutePath, ent.name),
        isDirectory: ent.isDirectory()
      })).sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      return NextResponse.json({ type: "directory", path: absolutePath, items });
    } else {
      const content = await fs.readFile(absolutePath, "utf-8");
      return NextResponse.json({ type: "file", path: absolutePath, content });
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  try {
    const body = await req.json();
    const { path: targetPath, content } = body;
    
    if (!targetPath || content === undefined) {
      return NextResponse.json({ error: "Missing path or content" }, { status: 400 });
    }

    const absolutePath = path.resolve(targetPath);
    if (!absolutePath.startsWith(ALLOWED_ROOT)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Buat folder jika belum ada
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, "utf-8");
    
    return NextResponse.json({ success: true, path: absolutePath });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}