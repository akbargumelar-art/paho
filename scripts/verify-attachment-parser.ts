import { parseFileBlocks } from "../src/lib/chat-attachments";

function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " :: " + detail : ""}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  // Case 1: markdown with INNER fenced code blocks (the reported bug)
  const reply1 = [
    "Berikut file PRD-nya:",
    "",
    "```file: DATABASE_SCHEMA.md",
    "# DATABASE SCHEMA — DigiposAja Web (PostgreSQL)",
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
    "CREATE TABLE transactions (id UUID PRIMARY KEY);",
    "```",
    "",
    "Selesai.",
    "```",
    "",
    "Semoga membantu.",
  ].join("\n");

  const b1 = parseFileBlocks(reply1);
  check("case1: satu blok terdeteksi", b1.length === 1, `got ${b1.length}`);
  check("case1: nama file benar", b1[0]?.filename === "DATABASE_SCHEMA.md", b1[0]?.filename);
  check("case1: isi TIDAK terpotong di fence pertama", (b1[0]?.body || "").includes("## 2. transactions"));
  check("case1: isi sampai baris terakhir", (b1[0]?.body || "").trim().endsWith("Selesai."));
  check("case1: inner sql fence ikut terbawa", (b1[0]?.body || "").includes("CREATE TABLE transactions"));

  // Case 2: multiple files in one reply
  const reply2 = [
    "Dua file ya:",
    "```file: PRD.md",
    "# PRD",
    "```bash",
    "npm run build",
    "```",
    "akhir prd",
    "```",
    "```file: PLAN.md",
    "# PLAN",
    "isi plan",
    "```",
  ].join("\n");

  const b2 = parseFileBlocks(reply2);
  check("case2: dua blok terdeteksi", b2.length === 2, `got ${b2.length}`);
  check("case2: file1 tidak bocor ke file2", !(b2[0]?.body || "").includes("# PLAN"));
  check("case2: file1 lengkap", (b2[0]?.body || "").includes("akhir prd"));
  check("case2: file2 benar", (b2[1]?.body || "").includes("isi plan"));

  // Case 3: 4-backtick wrapper (unambiguous)
  const reply3 = [
    "````file: README.md",
    "# Judul",
    "```js",
    "console.log('hi');",
    "```",
    "tutup",
    "````",
  ].join("\n");
  const b3 = parseFileBlocks(reply3);
  check("case3: satu blok", b3.length === 1, `got ${b3.length}`);
  check("case3: isi lengkap", (b3[0]?.body || "").includes("tutup"));

  // Case 4: no file block -> no attachments
  check("case4: tanpa blok file", parseFileBlocks("halo tidak ada file").length === 0);

  // Case 5: plain code block must NOT be captured
  check("case5: code block biasa diabaikan", parseFileBlocks("```js\nlet a=1;\n```").length === 0);
}

main();
