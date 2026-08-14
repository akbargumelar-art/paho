import type {
  ApprovalPath,
  Domain,
  JobStatus,
  JobType,
  PilotPhase,
  ReminderStatus,
  RepeatInterval,
  ReviewStatus,
  RiskLevel,
  TaskStatus,
} from "@/lib/mock-data";
import { badRequest } from "@/lib/api/errors";

const DOMAINS = ["personal", "business", "work"] as const satisfies readonly Domain[];
const TASK_STATUSES = ["pending", "in-progress", "completed"] as const satisfies readonly TaskStatus[];
const RISK_LEVELS = ["low", "medium", "high", "critical"] as const satisfies readonly RiskLevel[];
const REMINDER_STATUSES = ["active", "completed", "archived"] as const satisfies readonly ReminderStatus[];
const REPEAT_INTERVALS = ["none", "daily", "weekly", "monthly", "yearly"] as const satisfies readonly RepeatInterval[];
const RUNTIME_MODES = ["plan_only", "hermes_cron"] as const;
const JOB_TYPES = ["cron", "polling", "subagent_task"] as const satisfies readonly JobType[];
const JOB_STATUSES = ["queued", "running", "waiting_approval", "done"] as const satisfies readonly JobStatus[];
const APPROVAL_PATHS = [
  "Telegram-safe",
  "Telegram-safe-with-review",
  "SSH-only",
  "OpenClaw-backend-only",
] as const satisfies readonly ApprovalPath[];
const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const satisfies readonly ReviewStatus[];
const PILOT_PHASES = [
  "initial_7_14_days",
  "stabilization_30_90_days",
] as const satisfies readonly PilotPhase[];

function hasOwn(payload: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(payload, key);
}

function readString(
  payload: Record<string, unknown>,
  key: string,
  {
    required = false,
    allowEmpty = false,
    nullable = false,
  }: {
    required?: boolean;
    allowEmpty?: boolean;
    nullable?: boolean;
  } = {},
) {
  if (!hasOwn(payload, key)) {
    if (required) badRequest(`"${key}" is required.`);
    return undefined;
  }

  const value = payload[key];

  if (value === null) {
    if (nullable) return null;
    badRequest(`"${key}" cannot be null.`);
  }

  if (typeof value !== "string") {
    badRequest(`"${key}" must be a string.`);
  }

  const stringValue = value as string;
  const normalized = allowEmpty ? stringValue : stringValue.trim();

  if (!allowEmpty && normalized.length === 0) {
    badRequest(`"${key}" cannot be empty.`);
  }

  return normalized;
}

function readBoolean(payload: Record<string, unknown>, key: string, required = false) {
  if (!hasOwn(payload, key)) {
    if (required) badRequest(`"${key}" is required.`);
    return undefined;
  }

  const value = payload[key];

  if (typeof value !== "boolean") {
    badRequest(`"${key}" must be a boolean.`);
  }

  return value as boolean;
}

function readEnum<const T extends readonly string[]>(
  payload: Record<string, unknown>,
  key: string,
  values: T,
  required = false,
) {
  const value = readString(payload, key, { required });

  if (value == null) return undefined;

  if (!values.includes(value as T[number])) {
    badRequest(`"${key}" must be one of: ${values.join(", ")}.`);
  }

  return value as T[number];
}

function readDateOnly(payload: Record<string, unknown>, key: string, required = false) {
  const value = readString(payload, key, { required });

  if (value == null) return undefined;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    badRequest(`"${key}" must use YYYY-MM-DD format.`);
  }

  return value;
}

function readDateTime(payload: Record<string, unknown>, key: string, required = false) {
  const value = readString(payload, key, { required });

  if (value == null) return undefined;

  if (Number.isNaN(Date.parse(value))) {
    badRequest(`"${key}" must be a valid date-time string.`);
  }

  return value;
}

function readHexColor(payload: Record<string, unknown>, key: string, required = false) {
  const value = readString(payload, key, { required });

  if (value == null) return undefined;

  if (!/^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value)) {
    badRequest(`"${key}" must be a valid hex color.`);
  }

  return value;
}

function readNestedObject(payload: Record<string, unknown>, key: string) {
  if (!hasOwn(payload, key)) return undefined;

  const value = payload[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    badRequest(`"${key}" must be an object.`);
  }

  return value as Record<string, unknown>;
}

function ensureUpdatePayload<T extends Record<string, unknown>>(updates: T) {
  if (Object.keys(updates).length === 0) {
    badRequest("No valid fields were provided for update.");
  }

  return updates;
}

export function parseTaskCreate(payload: Record<string, unknown>) {
  return {
    id: readString(payload, "id") ?? `t-${Date.now()}`,
    title: readString(payload, "title", { required: true })!,
    details: readString(payload, "details", { allowEmpty: true }) ?? "",
    status: readEnum(payload, "status", TASK_STATUSES) ?? "pending",
    owner: "HERMES" as const,
    domain: readEnum(payload, "domain", DOMAINS, true)!,
    groupId: readString(payload, "groupId", { nullable: true }),
    riskLevel: readEnum(payload, "riskLevel", RISK_LEVELS) ?? "low",
    dueDate: readDateOnly(payload, "dueDate", true)!,
    createdAt: readDateOnly(payload, "createdAt") ?? new Date().toISOString().split("T")[0],
  };
}

export function parseTaskUpdate(payload: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};

  if (hasOwn(payload, "title")) updates.title = readString(payload, "title", { required: true });
  if (hasOwn(payload, "details")) updates.details = readString(payload, "details", { allowEmpty: true }) ?? "";
  if (hasOwn(payload, "status")) updates.status = readEnum(payload, "status", TASK_STATUSES, true);
  if (hasOwn(payload, "domain")) updates.domain = readEnum(payload, "domain", DOMAINS, true);
  if (hasOwn(payload, "groupId")) updates.groupId = readString(payload, "groupId", { nullable: true });
  if (hasOwn(payload, "riskLevel")) updates.riskLevel = readEnum(payload, "riskLevel", RISK_LEVELS, true);
  if (hasOwn(payload, "dueDate")) updates.dueDate = readDateOnly(payload, "dueDate", true);

  return ensureUpdatePayload(updates);
}

export function parseTaskGroupCreate(payload: Record<string, unknown>) {
  return {
    id: readString(payload, "id") ?? `g-${Date.now()}`,
    name: readString(payload, "name", { required: true })!,
    domain: readEnum(payload, "domain", DOMAINS, true)!,
    color: readHexColor(payload, "color", true)!,
    icon: readString(payload, "icon", { required: true })!,
    createdAt: readDateOnly(payload, "createdAt") ?? new Date().toISOString().split("T")[0],
  };
}

export function parseTaskGroupUpdate(payload: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};

  if (hasOwn(payload, "name")) updates.name = readString(payload, "name", { required: true });
  if (hasOwn(payload, "domain")) updates.domain = readEnum(payload, "domain", DOMAINS, true);
  if (hasOwn(payload, "color")) updates.color = readHexColor(payload, "color", true);
  if (hasOwn(payload, "icon")) updates.icon = readString(payload, "icon", { required: true });

  return ensureUpdatePayload(updates);
}

export function parseReminderCreate(payload: Record<string, unknown>) {
  return {
    id: readString(payload, "id") ?? `r-${Date.now()}`,
    taskId: readString(payload, "taskId", { nullable: true }),
    title: readString(payload, "title", { required: true })!,
    triggerTime: readDateTime(payload, "triggerTime", true)!,
    isActive: readBoolean(payload, "isActive") ?? true,
    owner: "HERMES" as const,
    domain: readEnum(payload, "domain", DOMAINS, true)!,
    status: readEnum(payload, "status", REMINDER_STATUSES) ?? "active",
    repeat: readEnum(payload, "repeat", REPEAT_INTERVALS) ?? "none",
    runtimeMode: readEnum(payload, "runtimeMode", RUNTIME_MODES) ?? "plan_only",
    runtimeJobId: readString(payload, "runtimeJobId", { nullable: true }) ?? null,
  };
}

export function parseReminderUpdate(payload: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};

  if (hasOwn(payload, "taskId")) updates.taskId = readString(payload, "taskId", { nullable: true });
  if (hasOwn(payload, "title")) updates.title = readString(payload, "title", { required: true });
  if (hasOwn(payload, "triggerTime")) updates.triggerTime = readDateTime(payload, "triggerTime", true);
  if (hasOwn(payload, "isActive")) updates.isActive = readBoolean(payload, "isActive", true);
  if (hasOwn(payload, "domain")) updates.domain = readEnum(payload, "domain", DOMAINS, true);
  if (hasOwn(payload, "status")) updates.status = readEnum(payload, "status", REMINDER_STATUSES, true);
  if (hasOwn(payload, "repeat")) updates.repeat = readEnum(payload, "repeat", REPEAT_INTERVALS, true);
  if (hasOwn(payload, "runtimeMode")) updates.runtimeMode = readEnum(payload, "runtimeMode", RUNTIME_MODES, true);
  if (hasOwn(payload, "runtimeJobId")) updates.runtimeJobId = readString(payload, "runtimeJobId", { nullable: true });

  return ensureUpdatePayload(updates);
}

export function parseJobCreate(payload: Record<string, unknown>) {
  const contextPack = readNestedObject(payload, "contextPack");

  return {
    id: readString(payload, "id") ?? `j-${Date.now()}`,
    taskId: readString(payload, "taskId", { required: true })!,
    contextInstruction:
      readString(contextPack ?? payload, "instruction") ??
      readString(payload, "contextInstruction") ??
      "",
    contextDataSource:
      readString(contextPack ?? payload, "dataSource") ??
      readString(payload, "contextDataSource") ??
      "",
    contextSchedule:
      readString(contextPack ?? payload, "schedule") ??
      readString(payload, "contextSchedule") ??
      "",
    worker: "OPENCLAW" as const,
    jobType: readEnum(payload, "jobType", JOB_TYPES, true)!,
    status: readEnum(payload, "status", JOB_STATUSES) ?? "queued",
    returnOutput: readString(payload, "returnOutput", { allowEmpty: true, nullable: true }) ?? null,
    domain: readEnum(payload, "domain", DOMAINS, true)!,
    ownerFinal: readEnum(payload, "ownerFinal", ["Hermes", "OpenClaw"] as const) ?? "Hermes",
    returnPath: readString(payload, "returnPath") ?? "Dashboard",
    approvalPath: readEnum(payload, "approvalPath", APPROVAL_PATHS, true)!,
    riskLevel: readEnum(payload, "riskLevel", RISK_LEVELS) ?? "low",
  };
}

export function parseApprovalUpdate(payload: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};

  if (hasOwn(payload, "isApproved")) {
    const value = payload.isApproved;
    if (value !== null && typeof value !== "boolean") {
      badRequest("\"isApproved\" must be a boolean or null.");
    }
    updates.isApproved = value;
  }

  if (hasOwn(payload, "reviewedBy")) {
    updates.reviewedBy = readString(payload, "reviewedBy", { allowEmpty: false, nullable: true });
  }

  if (hasOwn(payload, "reviewStatus")) {
    updates.reviewStatus = readEnum(payload, "reviewStatus", REVIEW_STATUSES, true);
  }

  const normalized = ensureUpdatePayload(updates);

  if (!("reviewStatus" in normalized) && "isApproved" in normalized) {
    normalized.reviewStatus =
      normalized.isApproved === true
        ? "approved"
        : normalized.isApproved === false
          ? "rejected"
          : "pending";
  }

  return normalized;
}

export function parsePilotUpdate(payload: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};

  if (hasOwn(payload, "isPassed")) updates.isPassed = readBoolean(payload, "isPassed", true);
  if (hasOwn(payload, "note")) updates.note = readString(payload, "note", { allowEmpty: true }) ?? "";
  if (hasOwn(payload, "phase")) updates.phase = readEnum(payload, "phase", PILOT_PHASES, true);

  return ensureUpdatePayload(updates);
}



