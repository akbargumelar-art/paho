import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { getAuthSession, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";

const HERMES_ENV = "/root/.hermes/.env";
const STT_MODEL = process.env.PAHO_STT_MODEL || "scribe_v1";

async function readElevenLabsKey(): Promise<string | null> {
  try {
    const raw = await readFile(HERMES_ENV, "utf8");
    for (const line of raw.split("\n")) {
      if (line.startsWith("ELEVENLABS_API_KEY=")) {
        const value = line.slice("ELEVENLABS_API_KEY=".length).trim();
        return value || null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();
  const key = await readElevenLabsKey();
  return NextResponse.json({ available: Boolean(key), engine: key ? "elevenlabs-scribe" : null });
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const key = await readElevenLabsKey();
  if (!key) {
    return NextResponse.json(
      { error: "Transkripsi server belum tersedia. Gunakan dikte browser (mic) atau ketik manual." },
      { status: 503 }
    );
  }

  try {
    const incoming = await req.formData();
    const file = incoming.get("audio");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "File audio tidak ditemukan." }, { status: 400 });
    }

    const form = new FormData();
    form.append("file", file, "recording.webm");
    form.append("model_id", STT_MODEL);
    form.append("language_code", "ind");

    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": key },
      body: form,
      signal: AbortSignal.timeout(90_000),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = (data as { detail?: { message?: string } } | null)?.detail?.message;
      return NextResponse.json({ error: detail || `Transkripsi gagal (${res.status}).` }, { status: 502 });
    }

    const text = String((data as { text?: string } | null)?.text || "").trim();
    return NextResponse.json({ text });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
