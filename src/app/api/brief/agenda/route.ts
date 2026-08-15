import { NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { isCategory, isPriority, logEvent, rowToTask, taskworkClient } from "@/lib/taskwork";

export const runtime = "nodejs";

/**
 * Write surface for the Morning Brief agenda.
 *
 * Writes go to Abay's REAL Taskwork DB (same rows the Kanban board and the
 * Hermes/Telegram flow use), so a task ticked off here is ticked off
 * everywhere. Only two operations are exposed: create a task, and toggle
 * done/undone. Anything richer belongs on the Kanban page.
 */

/** Local YYYY-MM-DD; toISOString() would shift the day in UTC+7. */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title || "").trim();
  const category = isCategory(body?.category) ? body.category : "work";
  const priority = isPriority(body?.priority) ? body.priority : "normal";
  // Default the due date to today: this is the "today" agenda, so an item added
  // here without a date should appear in it rather than vanish into undated.
  const rawDue = body?.dueDate === undefined ? localToday() : String(body.dueDate).trim();
  const dueDate = rawDue || null;
  const notes = String(body?.notes || "").trim() || null;

  if (!title) return NextResponse.json({ error: "Judul tugas wajib diisi." }, { status: 400 });
  if (title.length > 300) return NextResponse.json({ error: "Judul terlalu panjang." }, { status: 400 });
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return NextResponse.json({ error: "Format tanggal harus YYYY-MM-DD." }, { status: 400 });
  }

  const db = taskworkClient();
  try {
    const inserted = await db.execute({
      sql: "INSERT INTO tasks (category, title, status, priority, due_date, notes, source) VALUES (?, ?, 'todo', ?, ?, ?, 'paho-brief') RETURNING *",
      args: [category, title, priority, dueDate, notes],
    });
    const task = rowToTask(inserted.rows[0]);
    await logEvent(db, task.id, "created", null, "todo", "via Paho Morning Brief");
    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  } finally {
    db.close();
  }
}

export async function PATCH(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "ID tugas tidak valid." }, { status: 400 });
  }
  const done = Boolean(body?.done);

  const db = taskworkClient();
  try {
    const existing = await db.execute({ sql: "SELECT * FROM tasks WHERE id = ?", args: [id] });
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Tugas tidak ditemukan." }, { status: 404 });
    }
    const before = rowToTask(existing.rows[0]);
    const status = done ? "done" : "todo";
    if (before.status === status) return NextResponse.json({ task: before });

    // Un-ticking must clear completed_at, otherwise the task keeps counting as
    // finished today in the brief's "selesai hari ini" query.
    const completedAt = done ? new Date().toISOString() : null;
    const updated = await db.execute({
      sql: "UPDATE tasks SET status = ?, completed_at = ?, updated_at = datetime('now','localtime') WHERE id = ? RETURNING *",
      args: [status, completedAt, id],
    });
    const task = rowToTask(updated.rows[0]);
    await logEvent(db, id, "status_changed", before.status, status, "via Paho Morning Brief");
    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  } finally {
    db.close();
  }
}
