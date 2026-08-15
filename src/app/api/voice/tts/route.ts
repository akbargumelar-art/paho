import { NextResponse } from "next/server";
import { readFile, mkdir } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { getAuthSession, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const HERMES_ENV = "/root/.hermes/.env";
const TMP_DIR = "/root/paho/data/voice-cache";

// ElevenLabs defaults mirror the Hermes config so the voice sounds consistent
// between Telegram voice notes and Paho.
const EL_VOICE_ID = process.env.PAHO_TTS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
const EL_MODEL_ID = process.env.PAHO_TTS_MODEL_ID || "eleven_multilingual_v2";

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
    // fall through to local fallback
  }
  return null;
}

/** Local offline fallback so voice still works if the cloud key is missing. */
async function espeakFallback(text: string): Promise<Buffer> {
  await mkdir(TMP_DIR, { recursive: true });
  const wav = path.join(TMP_DIR, `tts-${Date.now()}.wav`);
  await execFileAsync("espeak-ng", ["-v", "id", "-s", "150", "-w", wav, text.slice(0, 2000)], { timeout: 30_000 });
  const buffer = await readFile(wav);
  return buffer;
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  try {
    const { text } = (await req.json()) as { text?: string };
    const clean = (text || "").replace(/```[\s\S]*?```/g, " (blok kode dilewati) ").trim();
    if (!clean) return NextResponse.json({ error: "Teks kosong." }, { status: 400 });
    const limited = clean.slice(0, 4000);

    const key = await readElevenLabsKey();
    if (key) {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE_ID}`, {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({
          text: limited,
          model_id: EL_MODEL_ID,
          voice_settings: { stability: 0.45, similarity_boost: 0.8 },
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) {
        const audio = Buffer.from(await res.arrayBuffer());
        return new NextResponse(new Uint8Array(audio), {
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-TTS-Engine": "elevenlabs" },
        });
      }
      // Cloud failed (quota/network) — degrade to local voice instead of erroring out.
      console.error("[paho-tts] elevenlabs failed", res.status);
    }

    const wav = await espeakFallback(limited);
    return new NextResponse(new Uint8Array(wav), {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store", "X-TTS-Engine": "espeak-ng" },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();
  const key = await readElevenLabsKey();
  return NextResponse.json({ engine: key ? "elevenlabs" : "espeak-ng", cloudAvailable: Boolean(key) });
}
