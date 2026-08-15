import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { getChatAttachment } from "@/lib/chat-attachments";

export const runtime = "nodejs";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const { id } = await context.params;
  const attachment = await getChatAttachment(id);
  if (!attachment) return NextResponse.json({ error: "Attachment tidak ditemukan." }, { status: 404 });

  const file = await readFile(attachment.path);
  return new NextResponse(file, {
    headers: {
      "Content-Type": attachment.type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.name)}"`,
      "Content-Length": String(file.length),
    },
  });
}
