import { readFile } from "fs/promises";
import path from "path";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Serves the stored avatar / app logo.
 *
 * Kept behind the session check and reading only from a fixed directory with a
 * fixed filename per kind, so no user input reaches the path.
 */
const BRANDING_DIR = "/root/paho/data/branding";
const APP_SETTINGS = path.join(BRANDING_DIR, "app.json");
const CONTENT_TYPE: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const kind = new URL(req.url).searchParams.get("kind") || "";
  if (kind !== "avatar" && kind !== "logo") {
    return NextResponse.json({ error: "kind harus 'avatar' atau 'logo'." }, { status: 400 });
  }

  let ext: string | null = null;
  try {
    const settings = JSON.parse(await readFile(APP_SETTINGS, "utf8"));
    ext = kind === "avatar" ? settings.avatarExt : settings.logoExt;
  } catch {
    ext = null;
  }
  if (!ext || !CONTENT_TYPE[ext]) {
    return NextResponse.json({ error: "Belum ada gambar." }, { status: 404 });
  }

  try {
    const buffer = await readFile(path.join(BRANDING_DIR, `${kind}.${ext}`));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": CONTENT_TYPE[ext],
        // Must revalidate: the file is replaced in place on every upload.
        "Cache-Control": "no-cache, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json({ error: "Gambar tidak terbaca." }, { status: 404 });
  }
}
