import { NextResponse } from "next/server";
import { execFile, type ExecFileException } from "child_process";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { commandCatalog, findCommand } from "@/lib/safe-console";

export const runtime = "nodejs";
export const maxDuration = 60;

const TIMEOUT_MS = 20_000;
const MAX_OUTPUT = 60_000;

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();
  return NextResponse.json({ commands: commandCatalog(), readOnly: true, timeoutMs: TIMEOUT_MS });
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const name = String(body?.command || "").trim();
  const rawArgs = Array.isArray(body?.args) ? body.args.map((a: unknown) => String(a)) : [];

  const spec = findCommand(name);
  if (!spec) {
    return NextResponse.json({ error: `Perintah "${name}" tidak ada di daftar aman.` }, { status: 400 });
  }

  const validated = spec.validate(rawArgs);
  if (validated === null) {
    return NextResponse.json({ error: "Argumen tidak valid atau di luar folder yang diizinkan." }, { status: 400 });
  }

  const args = [...(spec.fixedArgs || []), ...validated];
  const startedAt = Date.now();

  // execFile with an argv array: no shell, so ; | && $() are inert.
  const result = await new Promise<{ stdout: string; stderr: string; code: number; timedOut: boolean }>((resolve) => {
    const child = execFile(
      spec.bin,
      args,
      {
        timeout: TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
          HOME: "/root",
        },
      },
      (error: ExecFileException | null, stdout: string, stderr: string) => {
        resolve({
          stdout: String(stdout || "").slice(0, MAX_OUTPUT),
          stderr: String(stderr || "").slice(0, MAX_OUTPUT),
          code: error ? (typeof error.code === "number" ? error.code : 1) : 0,
          timedOut: Boolean(error && error.code === "ETIMEDOUT"),
        });
      },
    );
    child.on("error", () => resolve({ stdout: "", stderr: "Gagal menjalankan perintah.", code: 1, timedOut: false }));
  });

  return NextResponse.json({
    command: `${spec.name}${validated.length ? ` ${validated.join(" ")}` : ""}`,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.code,
    timedOut: result.timedOut,
    durationMs: Date.now() - startedAt,
  });
}
