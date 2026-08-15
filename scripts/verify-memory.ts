/**
 * Real verification harness for the Paho memory layer.
 * Run with: npx tsx scripts/verify-memory.ts
 */
import {
  buildProjectIndex,
  chunkText,
  formatProjectMemory,
  formatRetrievedContext,
  makeThreadSummary,
  needsSummarization,
  readIndex,
  readProjectMemory,
  retrieveChunks,
  saveProjectMemory,
} from "../src/lib/memory-layer";
import { readFile } from "fs/promises";

async function main() {
  const projectsRaw = await readFile("/root/paho/data/web-chat/projects.json", "utf8");
  const project = JSON.parse(projectsRaw).projects[0];

  console.log("=== SOURCE DATA ===");
  console.log("project:", project.id, "| instruction:", project.instruction.length, "chars | knowledge:", project.knowledge.length, "chars | files:", (project.uploadedFiles || []).length);

  console.log("\n=== 1. CHUNKING ===");
  const chunks = chunkText(project.knowledge);
  console.log("knowledge chunks:", chunks.length);
  console.log("avg chunk size:", Math.round(chunks.reduce((s, c) => s + c.length, 0) / chunks.length));

  console.log("\n=== 2. BUILD INDEX ===");
  const index = await buildProjectIndex(project.id, {
    instruction: project.instruction,
    knowledge: project.knowledge,
    uploadedFiles: project.uploadedFiles,
  });
  console.log("total chunks indexed:", index.chunks.length);
  const bySource = index.chunks.reduce<Record<string, number>>((acc, c) => {
    const key = `${c.sourceType}:${c.sourceId ?? "-"}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  console.log("chunks by source:", JSON.stringify(bySource, null, 2));
  console.log("total token estimate:", index.chunks.reduce((s, c) => s + c.tokensEstimate, 0));

  console.log("\n=== 3. INDEX PERSISTENCE ===");
  const reloaded = await readIndex(project.id);
  console.log("reloaded from disk:", reloaded ? `${reloaded.chunks.length} chunks` : "FAILED");

  console.log("\n=== 4. RETRIEVAL ===");
  const queries = [
    "bagaimana cara pakai endpoint injectVoucher",
    "apa itu payment_method LINKAJA",
    "jelaskan struktur PRD untuk web digiposaja",
  ];
  for (const q of queries) {
    const hits = retrieveChunks(index, q);
    const formatted = formatRetrievedContext(hits);
    console.log(`\nquery: "${q}"`);
    console.log("  retrieved chunks:", hits.length);
    console.log("  sources:", hits.map((h) => `${h.sourceType}:${h.sourceId ?? "-"}`).join(", ") || "(none)");
    console.log("  context chars:", formatted.length, "(vs full knowledge", project.knowledge.length + ")");
  }

  console.log("\n=== 5. THREAD SUMMARIZATION ===");
  const threadRaw = await readFile("/root/paho/data/web-chat/threads/chat-mst8hsfl-efr0w.json", "utf8");
  const messages = JSON.parse(threadRaw).messages;
  console.log("thread messages:", messages.length, "| total chars:", messages.reduce((s: number, m: { content: string }) => s + m.content.length, 0));
  console.log("needsSummarization(18, null):", needsSummarization(messages.length, null));
  const summary = makeThreadSummary(messages);
  console.log("summary chars:", summary.length);
  console.log("summary preview:", summary.slice(0, 200).replace(/\n/g, " | "));

  console.log("\n=== 6. PROJECT MEMORY ===");
  await saveProjectMemory({
    projectId: project.id,
    summary: "Project membangun versi web DigiposAja memakai API bridge commands.html.",
    facts: ["API bridge didokumentasikan di commands.html", "payment_method utama LINKAJA"],
    decisions: ["Pakai Next.js untuk frontend web"],
    todos: ["Susun ulang PRD", "Definisikan endpoint prioritas"],
    preferences: ["Bahasa Indonesia santai", "Output ringkas"],
    updatedAt: new Date().toISOString(),
  });
  const memory = await readProjectMemory(project.id);
  const formattedMemory = formatProjectMemory(memory);
  console.log("memory persisted:", memory.facts.length, "facts,", memory.decisions.length, "decisions,", memory.todos.length, "todos");
  console.log("formatted memory chars:", formattedMemory.length);

  console.log("\n=== 7. PROMPT SIZE COMPARISON ===");
  const oldPromptSize = project.instruction.length + project.knowledge.length + messages.slice(-8).reduce((s: number, m: { content: string }) => s + m.content.length, 0);
  const hits = retrieveChunks(index, queries[0]);
  const newPromptSize =
    formatProjectMemory(memory).length +
    formatRetrievedContext(hits).length +
    summary.length +
    messages.slice(-8).reduce((s: number, m: { content: string }) => s + Math.min(m.content.length, 1500), 0);
  console.log("OLD approach (full context + history):", oldPromptSize, "chars");
  console.log("NEW approach (memory + retrieval + summary):", newPromptSize, "chars");
  console.log("reduction:", Math.round((1 - newPromptSize / oldPromptSize) * 100) + "%");
}

main().catch((error) => {
  console.error("FAILED:", error);
  process.exit(1);
});
