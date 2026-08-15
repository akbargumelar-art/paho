import { readFile } from "fs/promises";
import { extractAndSaveChatAttachments, getChatAttachment } from "../src/lib/chat-attachments";

const md = [
  "# DATABASE SCHEMA — DigiposAja Web (PostgreSQL)",
  "",
  "Gunakan UUID + `gen_random_uuid()`.",
  "",
  "## 1. users",
  "",
  "```sql",
  "CREATE TABLE users (",
  "  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),",
  "  email TEXT NOT NULL UNIQUE",
  ");",
  "```",
  "",
  "## 2. transactions",
  "",
  "```sql",
  "CREATE TABLE transactions (",
  "  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),",
  "  msisdn TEXT NOT NULL",
  ");",
  "```",
  "",
  "## 3. Catatan",
  "",
  "| Tabel | Fungsi |",
  "|---|---|",
  "| users | akun operator |",
  "| transactions | histori transaksi |",
  "",
  "SELESAI-MARKER",
].join("\n");

async function main() {
  const reply = `Berikut file-nya abay:\n\n\`\`\`\`file: DATABASE_SCHEMA.md\n${md}\n\`\`\`\`\n\nSilakan dicek.`;

  const result = await extractAndSaveChatAttachments(reply, {
    projectId: "verify-e2e",
    threadId: "verify-thread",
  });

  console.log("attachments:", result.attachments.length);
  const att = result.attachments[0];
  console.log("name:", att.name, "| size:", att.size);
  console.log("chat content:", JSON.stringify(result.content.slice(0, 60)), "...");

  const stored = await getChatAttachment(att.id);
  const onDisk = await readFile(stored!.path, "utf8");

  const checks: [string, boolean][] = [
    ["isi utuh sama dengan sumber", onDisk.trim() === md.trim()],
    ["bagian akhir ada (SELESAI-MARKER)", onDisk.includes("SELESAI-MARKER")],
    ["section 2 ada", onDisk.includes("## 2. transactions")],
    ["section 3 ada", onDisk.includes("## 3. Catatan")],
    ["inner sql fence utuh", (onDisk.match(/```sql/g) || []).length === 2],
    ["tabel markdown utuh", onDisk.includes("| transactions | histori transaksi |")],
    ["ukuran sesuai isi", att.size === Buffer.byteLength(onDisk, "utf8")],
  ];
  for (const [label, ok] of checks) {
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
    if (!ok) process.exitCode = 1;
  }
  console.log("chars sumber:", md.length, "| chars tersimpan:", onDisk.length);
}

main();
