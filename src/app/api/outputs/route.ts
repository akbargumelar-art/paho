import { NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { listPahoOutputs } from "@/lib/paho-outputs";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();
  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 30)));
  const data = await listPahoOutputs(limit);
  return NextResponse.json({ ok: true, ...data });
}
