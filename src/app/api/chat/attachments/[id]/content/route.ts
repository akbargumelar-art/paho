import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { getChatAttachment } from "@/lib/chat-attachments";

const VIEWABLE = /\.(md|markdown|txt|json|csv|log|yml|yaml|html?|ts|tsx|js|jsx|sql|sh)$/i;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const { id } = await ctx.params;
  const file = await getChatAttachment(id);
  if (!file) return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });

  if (!VIEWABLE.test(file.name)) {
    return NextResponse.json(
      { id: file.id, name: file.name, size: file.size, viewable: false, content: "" },
      { status: 200 },
    );
  }

  try {
    const content = await readFile(file.path, "utf8");
    return NextResponse.json({
      id: file.id,
      name: file.name,
      type: file.type,
      size: file.size,
      createdAt: file.createdAt,
      viewable: true,
      content,
    });
  } catch {
    return NextResponse.json({ error: "File tidak dapat dibaca" }, { status: 404 });
  }
}
