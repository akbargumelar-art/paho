import { NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import {
  isCategory, isPriority, isStatus, logEvent, rowToTask, taskworkClient,
} from "@/lib/taskwork";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const db = taskworkClient();
  try {
    const where = isCategory(category) ? "WHERE category = ?" : "";
    const args = isCategory(category) ? [category] : [];
    const result = await db.execute({
      sql: `SELECT * FROM tasks ${where} ORDER BY
              CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
              COALESCE(due_date, '9999-12-31'), id DESC`,
      args,
    });
    const tasks = result.rows.map(rowToTask);
    const counts = tasks.reduce<Record<string, number>>((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {});
    return NextResponse.json({ tasks, counts, total: tasks.length });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  } finally {
    db.close();
  }
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title || "").trim();
  const category = isCategory(body?.category) ? body.category : "work";
  const priority = isPriority(body?.priority) ? body.priority : "normal";
  const status = isStatus(body?.status) ? body.status : "todo";
  const dueDate = String(body?.dueDate || "").trim() || null;
  const notes = String(body?.notes || "").trim() || null;

  if (!title) return NextResponse.json({ error: "Judul task wajib diisi." }, { status: 400 });
  if (title.length > 300) return NextResponse.json({ error: "Judul terlalu panjang." }, { status: 400 });
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return NextResponse.json({ error: "Format tanggal harus YYYY-MM-DD." }, { status: 400 });
  }

  const db = taskworkClient();
  try {
    const inserted = await db.execute({
      sql: "INSERT INTO tasks (category, title, status, priority, due_date, notes, source) VALUES (?, ?, ?, ?, ?, ?, 'paho') RETURNING *",
      args: [category, title, status, priority, dueDate, notes],
    });
    const task = rowToTask(inserted.rows[0]);
    await logEvent(db, task.id, "created", null, status);
    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  } finally {
    db.close();
  }
}

export async function PUT(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "ID task tidak valid." }, { status: 400 });
  }

  const db = taskworkClient();
  try {
    const existing = await db.execute({ sql: "SELECT * FROM tasks WHERE id = ?", args: [id] });
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Task tidak ditemukan." }, { status: 404 });
    }
    const before = rowToTask(existing.rows[0]);

    const status = isStatus(body?.status) ? body.status : before.status;
    const priority = isPriority(body?.priority) ? body.priority : before.priority;
    const category = isCategory(body?.category) ? body.category : before.category;
    const title = body?.title !== undefined ? String(body.title).trim() : before.title;
    const dueDate = body?.dueDate !== undefined ? (String(body.dueDate).trim() || null) : before.dueDate;
    const notes = body?.notes !== undefined ? (String(body.notes).trim() || null) : before.notes;

    if (!title) return NextResponse.json({ error: "Judul task wajib diisi." }, { status: 400 });
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return NextResponse.json({ error: "Format tanggal harus YYYY-MM-DD." }, { status: 400 });
    }

    // completed_at is only meaningful for done; clear it when moving back out.
    const completedAt = status === "done" ? (before.completedAt || new Date().toISOString()) : null;

    const updated = await db.execute({
      sql: `UPDATE tasks SET category = ?, title = ?, status = ?, priority = ?, due_date = ?, notes = ?, completed_at = ?
            WHERE id = ? RETURNING *`,
      args: [category, title, status, priority, dueDate, notes, completedAt, id],
    });
    const task = rowToTask(updated.rows[0]);
    if (before.status !== status) await logEvent(db, id, "status_changed", before.status, status);
    if (before.priority !== priority) await logEvent(db, id, "priority_changed", before.priority, priority);
    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  } finally {
    db.close();
  }
}
