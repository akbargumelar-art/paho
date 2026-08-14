import fs from "fs/promises";

const PROJECTS_MD = process.env.ASSISTANT_PROJECTS_MD || "/root/assistant/work/projects/hermes-openclaw-system/reference/governance/PROJECTS.md";

export type LiveProject = {
  id: string;
  title: string;
  description: string;
  status: "planning" | "active" | "archived";
  owner: string;
  domain: "personal" | "business" | "work";
  createdAt: string;
  sourceType: "assistant-projects-md";
};

function inferDomain(title: string, desc: string): LiveProject["domain"] {
  const text = `${title} ${desc}`.toLowerCase();
  if (text.includes("business")) return "business";
  if (text.includes("personal")) return "personal";
  return "work";
}

function inferStatus(text: string): LiveProject["status"] {
  const t = text.toLowerCase();
  if (t.includes("planned") || t.includes("future") || t.includes("concept")) return "planning";
  if (t.includes("archived")) return "archived";
  return "active";
}

export async function getAssistantProjects(): Promise<LiveProject[]> {
  try {
    const raw = await fs.readFile(PROJECTS_MD, "utf-8");
    const lines = raw.split(/\r?\n/);
    const out: LiveProject[] = [];
    let currentTitle = "";
    let bullets: string[] = [];
    let idx = 0;

    const flush = () => {
      if (!currentTitle) return;
      const joined = bullets.join(" ").trim();
      const ownerMatch = joined.match(/\*\*Owner:\*\*\s*([^\-]+)/i);
      out.push({
        id: `proj-md-${++idx}`,
        title: currentTitle,
        description: joined,
        status: inferStatus(joined),
        owner: ownerMatch ? ownerMatch[1].trim() : "Hermes",
        domain: inferDomain(currentTitle, joined),
        createdAt: "2026-04-04",
        sourceType: "assistant-projects-md",
      });
      currentTitle = "";
      bullets = [];
    };

    for (const line of lines) {
      if (line.startsWith("### ")) {
        flush();
        currentTitle = line.replace(/^###\s*\d+\.\s*/, "").trim();
      } else if (currentTitle && line.trim().startsWith("- ")) {
        bullets.push(line.trim().slice(2));
      }
    }
    flush();
    return out;
  } catch {
    return [];
  }
}
