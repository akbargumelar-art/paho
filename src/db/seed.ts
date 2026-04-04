import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";
import {
  mockTasks, mockReminders, mockProjects, mockJobs,
  mockLogs, mockApprovals, mockPilotItems, mockPolicies, mockTaskGroups,
} from "../lib/mock-data";
import * as fs from "fs";
import * as path from "path";

async function seed() {
  // Ensure data directory exists
  const dataDir = path.resolve(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log("📁 Created data/ directory");
  }

  const client = createClient({ url: "file:./data/aspri.db" });
  const db = drizzle(client, { schema });

  console.log("🔄 Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✅ Migrations complete");

  console.log("🌱 Seeding database...");

  // ---- Seed admin user via Better Auth tables ----
  // We insert directly; password hashed with bcrypt
  const bcrypt = (await import("bcryptjs")).default;
  const hashedPassword = await bcrypt.hash("admin", 10);
  const now = new Date();
  const adminId = "admin-user-001";


  await db.insert(schema.user).values({
    id: adminId,
    name: "Admin",
    email: "admin@aspri.local",
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
    username: "admin",
    displayUsername: "Admin",
  }).onConflictDoNothing();

  await db.insert(schema.account).values({
    id: "account-001",
    accountId: adminId,
    providerId: "credential",
    userId: adminId,
    password: hashedPassword,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  console.log("Admin user ensured (admin/admin)");

  // ---- Seed Task Groups ----
  for (const g of mockTaskGroups) {
    await db.insert(schema.taskGroups).values({
      id: g.id,
      name: g.name,
      domain: g.domain,
      color: g.color,
      icon: g.icon,
      createdAt: g.createdAt,
    }).onConflictDoNothing();
  }
  console.log(`📂 ${mockTaskGroups.length} task groups seeded`);

  // ---- Seed Tasks ----
  for (const t of mockTasks) {
    await db.insert(schema.tasks).values({
      id: t.id,
      title: t.title,
      details: t.details,
      status: t.status,
      owner: t.owner,
      domain: t.domain,
      groupId: t.groupId,
      riskLevel: t.riskLevel,
      dueDate: t.dueDate,
      createdAt: t.createdAt,
    }).onConflictDoNothing();
  }
  console.log(`✅ ${mockTasks.length} tasks seeded`);

  // ---- Seed Reminders ----
  for (const r of mockReminders) {
    await db.insert(schema.reminders).values({
      id: r.id,
      taskId: r.taskId,
      title: r.title,
      triggerTime: r.triggerTime,
      isActive: r.isActive,
      owner: r.owner,
      domain: r.domain,
      status: r.status,
      repeat: r.repeat || "none",
    }).onConflictDoNothing();
  }
  console.log(`🔔 ${mockReminders.length} reminders seeded`);

  // ---- Seed Projects ----
  for (const p of mockProjects) {
    await db.insert(schema.projects).values({
      id: p.id,
      title: p.title,
      description: p.description,
      status: p.status,
      domain: p.domain,
      createdAt: p.createdAt,
    }).onConflictDoNothing();
  }
  console.log(`📋 ${mockProjects.length} projects seeded`);

  // ---- Seed Handoff Jobs ----
  for (const j of mockJobs) {
    await db.insert(schema.handoffJobs).values({
      id: j.id,
      taskId: j.taskId,
      contextInstruction: j.contextPack.instruction,
      contextDataSource: j.contextPack.dataSource,
      contextSchedule: j.contextPack.schedule,
      worker: j.worker,
      jobType: j.jobType,
      status: j.status,
      returnOutput: j.returnOutput,
      domain: j.domain,
      ownerFinal: j.ownerFinal,
      returnPath: j.returnPath,
      approvalPath: j.approvalPath,
      riskLevel: j.riskLevel,
    }).onConflictDoNothing();
  }
  console.log(`⚙️  ${mockJobs.length} handoff jobs seeded`);

  // ---- Seed Execution Logs ----
  for (const l of mockLogs) {
    await db.insert(schema.executionLogs).values({
      id: l.id,
      jobId: l.jobId,
      message: l.message,
      level: l.level,
      source: l.source,
      owner: l.owner,
      domain: l.domain,
      approvalPath: l.approvalPath,
      status: l.status,
      metadata: JSON.stringify(l.metadata),
      timestamp: l.timestamp,
    }).onConflictDoNothing();
  }
  console.log(`📝 ${mockLogs.length} execution logs seeded`);

  // ---- Seed Approvals ----
  for (const a of mockApprovals) {
    await db.insert(schema.approvalGuardrails).values({
      id: a.id,
      jobId: a.jobId,
      notificationMethod: a.notificationMethod,
      requestPayload: a.requestPayload,
      isApproved: a.isApproved,
      reviewedBy: a.reviewedBy,
      reviewStatus: a.reviewStatus,
      riskLevel: a.riskLevel,
      approvalChannel: a.approvalChannel,
    }).onConflictDoNothing();
  }
  console.log(`🛡️  ${mockApprovals.length} approval guardrails seeded`);

  // ---- Seed Pilot Items ----
  for (const p of mockPilotItems) {
    await db.insert(schema.pilotEvaluationItems).values({
      id: p.id,
      criteria: p.criteria,
      isPassed: p.isPassed,
      note: p.note,
      phase: p.phase,
    }).onConflictDoNothing();
  }
  console.log(`📊 ${mockPilotItems.length} pilot evaluation items seeded`);

  // ---- Seed Model Policies ----
  for (const mp of mockPolicies) {
    await db.insert(schema.modelPolicies).values({
      id: mp.id,
      title: mp.title,
      description: mp.description,
      rules: JSON.stringify(mp.rules),
      tier: mp.tier,
      appliesTo: mp.appliesTo,
    }).onConflictDoNothing();
  }
  console.log(`📜 ${mockPolicies.length} model policies seeded`);

  console.log("\n🎉 Database seeded successfully!");
  client.close();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});


