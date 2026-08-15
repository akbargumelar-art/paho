import { createClient, type Client } from "@libsql/client";

/**
 * Shared access to Abay's existing Taskwork SQLite database. Paho reads AND
 * writes here, so the Kanban board and the Hermes/Telegram task flow stay in
 * sync instead of Paho keeping a private copy.
 */
export const TASKWORK_DB = "/root/obsidian-vault/90 Hermes/Taskwork/taskwork.db";

export const CATEGORIES = ["work", "personal", "bisnis"] as const;
export const STATUSES = ["todo", "in_progress", "done", "cancelled"] as const;
export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];

export type Task = {
  id: number;
  category: Category;
  title: string;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  notes: string | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export function taskworkClient(): Client {
  return createClient({ url: `file:${TASKWORK_DB}` });
}

export function isCategory(value: unknown): value is Category {
  return CATEGORIES.includes(String(value) as Category);
}
export function isStatus(value: unknown): value is Status {
  return STATUSES.includes(String(value) as Status);
}
export function isPriority(value: unknown): value is Priority {
  return PRIORITIES.includes(String(value) as Priority);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowToTask(row: any): Task {
  return {
    id: Number(row.id),
    category: row.category,
    title: String(row.title || ""),
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date ?? null,
    notes: row.notes ?? null,
    source: row.source ?? null,
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
    completedAt: row.completed_at ?? null,
  };
}

/** Records an audit row so Paho edits are traceable next to Hermes edits. */
export async function logEvent(db: Client, taskId: number, eventType: string, oldValue: string | null, newValue: string | null, note = "via Paho") {
  await db.execute({
    sql: "INSERT INTO task_events (task_id, event_type, old_value, new_value, note) VALUES (?, ?, ?, ?, ?)",
    args: [taskId, eventType, oldValue, newValue, note],
  });
}
