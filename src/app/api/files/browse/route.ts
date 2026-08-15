import { NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { ALLOWED_ROOTS, MAX_PREVIEW_BYTES, entryKind, isDenied, safeResolve } from "@/lib/file-browser";

export const runtime = "nodejs";

const TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".json", ".yaml", ".yml", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".css", ".scss", ".html", ".csv", ".log", ".sh", ".py", ".sql", ".env.example", ".toml", ".ini",
]);

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const url = new URL(req.url);
  const requested = url.searchParams.get("path");
  const mode = url.searchParams.get("mode") || "list";

  // No path -> return the allowlist itself so the UI can render roots.
  if (!requested) {
    return NextResponse.json({ roots: ALLOWED_ROOTS.map(({ id, label, path: p }) => ({ id, label, path: p })) });
  }

  const resolved = await safeResolve(requested);
  if (!resolved) {
    return NextResponse.json({ error: "Path di luar folder yang diizinkan." }, { status: 403 });
  }

  try {
    const info = await entryKind(resolved.absolute);

    if (mode === "read") {
      if (info.isDirectory) return NextResponse.json({ error: "Path adalah folder." }, { status: 400 });
      const ext = path.extname(resolved.absolute).toLowerCase();
      if (!TEXT_EXTENSIONS.has(ext)) {
        return NextResponse.json({ error: `Preview hanya untuk file teks (${ext || "tanpa ekstensi"} tidak didukung).` }, { status: 415 });
      }
      if (info.size > MAX_PREVIEW_BYTES) {
        return NextResponse.json({ error: `File terlalu besar untuk preview (${(info.size / 1024).toFixed(0)} KB > 512 KB).` }, { status: 413 });
      }
      const content = await readFile(resolved.absolute, "utf8");
      return NextResponse.json({ path: resolved.absolute, size: info.size, modified: info.modified, content, readOnly: true });
    }

    if (!info.isDirectory) {
      return NextResponse.json({ error: "Path adalah file, gunakan mode=read." }, { status: 400 });
    }

    const names = await readdir(resolved.absolute, { withFileTypes: true });
    const entries = [];
    for (const dirent of names) {
      const absolute = path.join(resolved.absolute, dirent.name);
      if (isDenied(absolute)) continue;
      try {
        const child = await entryKind(absolute);
        entries.push({
          name: dirent.name,
          path: absolute,
          isDirectory: child.isDirectory,
          size: child.size,
          modified: child.modified,
        });
      } catch {
        // Unreadable entry (broken symlink, permissions) is skipped rather than
        // failing the whole listing.
      }
    }
    entries.sort((a, b) => (a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1));

    const parent = path.dirname(resolved.absolute);
    const parentAllowed = Boolean(await safeResolve(parent));

    return NextResponse.json({
      path: resolved.absolute,
      parent: parentAllowed && parent !== resolved.absolute ? parent : null,
      entries,
      total: entries.length,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
