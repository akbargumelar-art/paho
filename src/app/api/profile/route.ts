import { NextResponse } from "next/server";
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * Profile management: display name, username, password, avatar, and the app
 * logo/branding.
 *
 * Password changes are delegated to Better Auth (`auth.api.changePassword`) so
 * we never hand-roll hashing or touch the credential row directly. Verified
 * available in better-auth 1.5.x alongside updateUser/setPassword.
 *
 * Images are stored on disk under data/branding and served back through
 * /api/profile/image?kind=... — writing into public/ would not survive a
 * rebuild and would bypass the auth check.
 */

const BRANDING_DIR = "/root/paho/data/branding";
const APP_SETTINGS = path.join(BRANDING_DIR, "app.json");
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

type AppBranding = { appName: string; logoExt: string | null; avatarExt: string | null; updatedAt: string };

const DEFAULT_BRANDING: AppBranding = { appName: "ASPRI", logoExt: null, avatarExt: null, updatedAt: "" };

async function readBranding(): Promise<AppBranding> {
  try {
    return { ...DEFAULT_BRANDING, ...JSON.parse(await readFile(APP_SETTINGS, "utf8")) };
  } catch {
    return { ...DEFAULT_BRANDING };
  }
}

async function saveBranding(data: AppBranding) {
  await mkdir(BRANDING_DIR, { recursive: true });
  await writeFile(APP_SETTINGS, JSON.stringify(data, null, 2));
}

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const branding = await readBranding();
  const rows = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1);
  const me = rows[0];
  return NextResponse.json({
    profile: {
      id: session.user.id,
      name: me?.name || session.user.name || "",
      email: me?.email || session.user.email || "",
      username: me?.username || "",
      hasAvatar: Boolean(branding.avatarExt),
    },
    branding: { appName: branding.appName, hasLogo: Boolean(branding.logoExt), updatedAt: branding.updatedAt },
  });
}

/** Update display name / username / app name. */
export async function PUT(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const name = body?.name === undefined ? undefined : String(body.name).trim();
  const username = body?.username === undefined ? undefined : String(body.username).trim().toLowerCase();
  const appName = body?.appName === undefined ? undefined : String(body.appName).trim();

  if (name !== undefined && (name.length < 1 || name.length > 80)) {
    return NextResponse.json({ error: "Nama harus 1-80 karakter." }, { status: 400 });
  }
  if (username !== undefined && !/^[a-z0-9._-]{3,32}$/.test(username)) {
    return NextResponse.json({ error: "Username 3-32 karakter, hanya huruf kecil, angka, titik, garis bawah, atau strip." }, { status: 400 });
  }
  if (appName !== undefined && (appName.length < 1 || appName.length > 40)) {
    return NextResponse.json({ error: "Nama aplikasi harus 1-40 karakter." }, { status: 400 });
  }

  try {
    if (name !== undefined || username !== undefined) {
      const payload: Record<string, string> = {};
      if (name !== undefined) payload.name = name;
      if (username !== undefined) payload.username = username;
      await auth.api.updateUser({ body: payload, headers: await headers() });
    }
    if (appName !== undefined) {
      const branding = await readBranding();
      await saveBranding({ ...branding, appName, updatedAt: new Date().toISOString() });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = (error as Error).message || "Gagal menyimpan profil.";
    // A duplicate username surfaces as a generic adapter error; make it useful.
    const friendly = /unique|constraint/i.test(message) ? "Username sudah dipakai." : message;
    return NextResponse.json({ error: friendly }, { status: 400 });
  }
}

/** Change password via Better Auth so hashing/session handling stays theirs. */
export async function PATCH(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const currentPassword = String(body?.currentPassword || "");
  const newPassword = String(body?.newPassword || "");
  const revokeOther = body?.revokeOtherSessions !== false;

  if (!currentPassword) return NextResponse.json({ error: "Password lama wajib diisi." }, { status: 400 });
  if (newPassword.length < 8) return NextResponse.json({ error: "Password baru minimal 8 karakter." }, { status: 400 });
  if (newPassword === currentPassword) return NextResponse.json({ error: "Password baru harus berbeda." }, { status: 400 });

  try {
    await auth.api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: revokeOther },
      headers: await headers(),
    });
    return NextResponse.json({ ok: true, revokedOtherSessions: revokeOther });
  } catch (error) {
    const message = (error as Error).message || "Gagal ganti password.";
    const friendly = /invalid|incorrect|password/i.test(message) ? "Password lama salah." : message;
    return NextResponse.json({ error: friendly }, { status: 400 });
  }
}

/** Upload avatar or app logo (multipart). */
export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Body harus multipart/form-data." }, { status: 400 });
  const kind = String(form.get("kind") || "");
  if (kind !== "avatar" && kind !== "logo") {
    return NextResponse.json({ error: "kind harus 'avatar' atau 'logo'." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "File kosong." }, { status: 400 });
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: `Maksimal ${MAX_IMAGE_BYTES / 1024 / 1024} MB.` }, { status: 400 });
  }
  const ext = ALLOWED_MIME[file.type];
  if (!ext) return NextResponse.json({ error: "Format harus PNG, JPG, WEBP, atau SVG." }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  await mkdir(BRANDING_DIR, { recursive: true });
  const branding = await readBranding();
  const prevExt = kind === "avatar" ? branding.avatarExt : branding.logoExt;
  // Filename is derived from a fixed prefix + validated extension only — the
  // client-supplied name never reaches the filesystem.
  const target = path.join(BRANDING_DIR, `${kind}.${ext}`);
  await writeFile(target, buffer);
  if (prevExt && prevExt !== ext) {
    await unlink(path.join(BRANDING_DIR, `${kind}.${prevExt}`)).catch(() => undefined);
  }
  await saveBranding({
    ...branding,
    avatarExt: kind === "avatar" ? ext : branding.avatarExt,
    logoExt: kind === "logo" ? ext : branding.logoExt,
    updatedAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true, kind, ext, size: buffer.length });
}

/** Remove avatar or logo. */
export async function DELETE(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const kind = new URL(req.url).searchParams.get("kind") || "";
  if (kind !== "avatar" && kind !== "logo") {
    return NextResponse.json({ error: "kind harus 'avatar' atau 'logo'." }, { status: 400 });
  }
  const branding = await readBranding();
  const ext = kind === "avatar" ? branding.avatarExt : branding.logoExt;
  if (ext) await unlink(path.join(BRANDING_DIR, `${kind}.${ext}`)).catch(() => undefined);
  await saveBranding({
    ...branding,
    avatarExt: kind === "avatar" ? null : branding.avatarExt,
    logoExt: kind === "logo" ? null : branding.logoExt,
    updatedAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}
