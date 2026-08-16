import { NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { exec } from "child_process";
import { promisify } from "util";
import net from "net";

const execAsync = promisify(exec);
export const runtime = "nodejs";

// Mencari port kosong berurutan dari port awal
async function findFreePort(startPort: number): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
    server.on("error", () => {
      resolve(findFreePort(startPort + 1));
    });
  });
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  try {
    const body = await req.json();
    const { path: workdir, command } = body;

    if (!workdir) {
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }

    // Cari port kosong mulai dari 3100
    const port = await findFreePort(3100);
    const appName = `vibe-${port}`;

    // Replace $PORT di command
    const cmdToRun = command ? command.replace("$PORT", port.toString()) : `npx serve -p ${port} .`;

    // Kita pakai PM2 untuk menjalankan aplikasinya di background supaya hidup terus.
    const pm2Cmd = `pm2 start "${cmdToRun}" --name "${appName}" --cwd "${workdir}"`;
    await execAsync(pm2Cmd);

    return NextResponse.json({ 
      success: true, 
      port, 
      appName,
      url: `https://paho.aarasa.click/preview-${port}/`
    });

  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
