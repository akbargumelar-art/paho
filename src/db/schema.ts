import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ============================================================
// BETTER AUTH TABLES
// ============================================================

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  username: text("username").unique(),
  displayUsername: text("display_username"),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// ============================================================
// APPLICATION TABLES
// ============================================================

// ---- TASK GROUPS ----
export const taskGroups = sqliteTable("task_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain").notNull(), // personal | business | work
  color: text("color").notNull(),
  icon: text("icon").notNull(),
  createdAt: text("created_at").notNull(),
});

// ---- TASKS ----
export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  details: text("details").notNull().default(""),
  status: text("status").notNull().default("pending"), // pending | in-progress | completed
  owner: text("owner").notNull().default("HERMES"),
  domain: text("domain").notNull(), // personal | business | work
  groupId: text("group_id").references(() => taskGroups.id, { onDelete: "set null" }),
  riskLevel: text("risk_level").notNull().default("low"), // low | medium | high | critical
  dueDate: text("due_date").notNull(),
  createdAt: text("created_at").notNull(),
});

// ---- REMINDERS ----
export const reminders = sqliteTable("reminders", {
  id: text("id").primaryKey(),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  triggerTime: text("trigger_time").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  owner: text("owner").notNull().default("HERMES"),
  domain: text("domain").notNull(),
  status: text("status").notNull().default("active"), // active | completed | archived
  repeat: text("repeat").default("none"), // none | daily | weekly | monthly | yearly
});

// ---- PROJECTS ----
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("planning"), // planning | active | archived
  domain: text("domain").notNull(),
  createdAt: text("created_at").notNull(),
});

// ---- HANDOFF JOBS ----
export const handoffJobs = sqliteTable("handoff_jobs", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  contextInstruction: text("context_instruction").notNull(),
  contextDataSource: text("context_data_source").notNull(),
  contextSchedule: text("context_schedule").notNull(),
  worker: text("worker").notNull().default("OPENCLAW"),
  jobType: text("job_type").notNull(), // cron | polling | subagent_task
  status: text("status").notNull().default("queued"), // queued | running | waiting_approval | done
  returnOutput: text("return_output"),
  domain: text("domain").notNull(),
  ownerFinal: text("owner_final").notNull(), // Hermes | OpenClaw
  returnPath: text("return_path").notNull(),
  approvalPath: text("approval_path").notNull(), // Telegram-safe | Telegram-safe-with-review | SSH-only | OpenClaw-backend-only
  riskLevel: text("risk_level").notNull().default("low"),
});

// ---- EXECUTION LOGS ----
export const executionLogs = sqliteTable("execution_logs", {
  id: text("id").primaryKey(),
  jobId: text("job_id"),
  message: text("message").notNull(),
  level: text("level").notNull(), // INFO | WARN | ERROR | CRITICAL
  source: text("source").notNull(), // Hermes | OpenClaw | System
  owner: text("owner").notNull(), // Hermes | OpenClaw
  domain: text("domain").notNull(),
  approvalPath: text("approval_path"),
  status: text("status").notNull(), // success | failed | pending
  metadata: text("metadata").notNull().default("{}"), // JSON string
  timestamp: text("timestamp").notNull(),
});

// ---- APPROVAL GUARDRAILS ----
export const approvalGuardrails = sqliteTable("approval_guardrails", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull(),
  notificationMethod: text("notification_method").notNull().default("Telegram Push"),
  requestPayload: text("request_payload").notNull(),
  isApproved: integer("is_approved", { mode: "boolean" }),
  reviewedBy: text("reviewed_by"),
  reviewStatus: text("review_status").notNull().default("pending"), // pending | approved | rejected
  riskLevel: text("risk_level").notNull(),
  approvalChannel: text("approval_channel").notNull(),
});

// ---- PILOT EVALUATION ----
export const pilotEvaluationItems = sqliteTable("pilot_evaluation_items", {
  id: text("id").primaryKey(),
  criteria: text("criteria").notNull(),
  isPassed: integer("is_passed", { mode: "boolean" }).notNull().default(false),
  note: text("note").notNull().default(""),
  phase: text("phase").notNull(), // initial_7_14_days | stabilization_30_90_days
});

// ---- MODEL POLICIES ----
export const modelPolicies = sqliteTable("model_policies", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  rules: text("rules").notNull().default("[]"), // JSON array string
  tier: text("tier").notNull(), // high | cheap
  appliesTo: text("applies_to").notNull(), // Hermes | OpenClaw | Both
});

// ============================================================
// HERMES LLM NATIVE STATE TABLES (from state.db)
// ============================================================

export const hermesSessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  userId: text("user_id"),
  model: text("model"),
  modelConfig: text("model_config"),
  systemPrompt: text("system_prompt"),
  parentSessionId: text("parent_session_id"),
  startedAt: real("started_at").notNull(),
  endedAt: real("ended_at"),
  endReason: text("end_reason"),
  messageCount: integer("message_count").default(0),
  toolCallCount: integer("tool_call_count").default(0),
  inputTokens: integer("input_tokens").default(0),
  outputTokens: integer("output_tokens").default(0),
  cacheReadTokens: integer("cache_read_tokens").default(0),
  cacheWriteTokens: integer("cache_write_tokens").default(0),
  reasoningTokens: integer("reasoning_tokens").default(0),
  billingProvider: text("billing_provider"),
  billingBaseUrl: text("billing_base_url"),
  billingMode: text("billing_mode"),
  estimatedCostUsd: real("estimated_cost_usd"),
  actualCostUsd: real("actual_cost_usd"),
  costStatus: text("cost_status"),
  costSource: text("cost_source"),
  pricingVersion: text("pricing_version"),
  title: text("title"),
});

export const hermesMessages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: text("session_id").notNull(),
  role: text("role").notNull(),
  content: text("content"),
  toolCallId: text("tool_call_id"),
  toolCalls: text("tool_calls"),
  toolName: text("tool_name"),
  timestamp: real("timestamp").notNull(),
  tokenCount: integer("token_count"),
  finishReason: text("finish_reason"),
  reasoning: text("reasoning"),
  reasoningDetails: text("reasoning_details"),
  codexReasoningItems: text("codex_reasoning_items"),
});
