import { NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { getTaskHistory } from "@/lib/live-sources/assistant-task-history";

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();
  const history = await getTaskHistory();
  return NextResponse.json({ history });
}
