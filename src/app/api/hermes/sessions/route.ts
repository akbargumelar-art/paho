import { NextResponse } from "next/server";
import path from "path";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { getRecentSessionFiles, readSessionFile } from "@/lib/live-sources/hermes-gateway";

// GET /api/hermes/sessions — list session JSONL files dari /root/.hermes/sessions/
export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

    // Ambil semua file session JSONL, sorted desc (terbaru dulu)
    const allFiles = await getRecentSessionFiles(200);
    const total = allFiles.length;
    const totalPages = Math.ceil(total / pageSize);
    const pageFiles = allFiles.slice((page - 1) * pageSize, page * pageSize);

    // Parse setiap file untuk ambil metadata (line pertama = session metadata biasanya)
    const sessions = await Promise.all(
      pageFiles.map(async (filePath) => {
        const filename = path.basename(filePath);
        const lines = await readSessionFile(filePath);
        // Ambil summary dari file — biasanya line pertama atau terakhir berisi metadata
        const firstLine = lines[0] ?? {};
        const lastLine = lines[lines.length - 1] ?? {};

        return {
          id: filename.replace(".jsonl", ""),
          filename,
          filePath,
          lineCount: lines.length,
          // Coba ambil field umum dari content
          startedAt: firstLine.timestamp ?? firstLine.started_at ?? firstLine.time ?? null,
          endedAt: lastLine.timestamp ?? lastLine.ended_at ?? lastLine.time ?? null,
          source: firstLine.source ?? firstLine.platform ?? "hermes",
          model: firstLine.model ?? null,
          role: firstLine.role ?? null,
          summary: firstLine.message ?? firstLine.content ?? null,
        };
      }),
    );

    return NextResponse.json({
      data: sessions,
      metadata: { total, page, pageSize, totalPages },
      isLive: total > 0,
    });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
