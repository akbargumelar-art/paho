import { NextResponse } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { asc, desc } from "drizzle-orm";
import { getAssistantProjects } from "@/lib/live-sources/assistant-projects";

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const [dbProjects, liveProjects] = await Promise.all([
    db.select().from(projects).orderBy(asc(projects.status), desc(projects.createdAt)),
    getAssistantProjects(),
  ]);

  return NextResponse.json({
    liveProjects,
    metadataProjects: dbProjects,
    combinedView: [...liveProjects, ...dbProjects.map((p) => ({ ...p, sourceType: "paho-project-db" }))],
    summary: {
      liveCount: liveProjects.length,
      metadataCount: dbProjects.length,
    },
  });
}
