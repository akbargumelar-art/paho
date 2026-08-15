import { readFile } from "fs/promises";
import { extractAndSaveChatAttachments, getChatAttachment } from "../src/lib/chat-attachments";

async function main() {
  const source = [
    "Berikut file PRD-nya.",
    "```file: PRD-Uji-Paho.md",
    "# PRD Uji Paho",
    "",
    "## Tujuan",
    "Menguji attachment chat yang dapat di-download.",
    "```",
    "",
    "Selesai.",
  ].join("\n");
  const result = await extractAndSaveChatAttachments(source, { projectId: "test", threadId: "verify" });
  if (result.attachments.length !== 1) throw new Error(`expected 1 file, got ${result.attachments.length}`);
  const file = result.attachments[0];
  const found = await getChatAttachment(file.id);
  const body = await readFile(file.path, "utf8");
  console.log(JSON.stringify({ content: result.content, attachment: { id: file.id, name: file.name, size: file.size }, found: found?.name, fileBody: body }, null, 2));
}
main().catch((error) => { console.error(error); process.exit(1); });
