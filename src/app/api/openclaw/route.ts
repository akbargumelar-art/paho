import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getAuthSession, unauthorized } from "@/lib/api-auth";

const OPENCLAW_FILE = process.platform === "win32" 
    ? path.join(process.cwd(), "data", "mock_openclaw.json") 
    : "/root/.openclaw/exec-approvals.json";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    try {
      const data = await fs.readFile(OPENCLAW_FILE, "utf-8");
      return NextResponse.json({ data: JSON.parse(data) });
    } catch (e: any) {
      if (e.code === 'ENOENT') {
         return NextResponse.json({ data: [] }); // File doesnt exist yet
      }
      throw e;
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const body = await req.json();
    
    // Save updated JSON back to file
    await fs.writeFile(OPENCLAW_FILE, JSON.stringify(body.data, null, 2), "utf-8");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
