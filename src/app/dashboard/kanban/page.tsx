"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw, KanbanSquare, CalendarDays, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Task = {
  id: number; category: "work" | "personal" | "bisnis"; title: string;
  status: "todo" | "in_progress" | "done" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  dueDate: string | null; notes: string | null; source: string | null;
  createdAt: string; updatedAt: string; completedAt: string | null;
};

const COLUMNS = [
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "Berjalan" },
  { id: "done", label: "Selesai" },
  { id: "cancelled", label: "Dibatalkan" },
] as const;

const CATEGORY_STYLE: Record<Task["category"], string> = {
  work: "bg-sky-500/15 text-sky-500 border-sky-500/30",
  personal: "bg-violet-500/15 text-violet-500 border-violet-500/30",
  bisnis: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
};
const PRIORITY_STYLE: Record<Task["priority"], string> = {
  urgent: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  normal: "bg-muted text-muted-foreground border-border",
  low: "bg-muted/60 text-muted-foreground border-border",
};

export default function KanbanPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<"semua" | Task["category"]>("semua");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", category: "work", priority: "normal", dueDate: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/kanban");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memuat task.");
      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(
    () => (category === "semua" ? tasks : tasks.filter((task) => task.category === category)),
    [tasks, category],
  );

  const move = async (task: Task, direction: -1 | 1) => {
    const order = COLUMNS.map((column) => column.id);
    const index = order.indexOf(task.status);
    const nextStatus = order[index + direction];
    if (!nextStatus) return;
    setBusyId(task.id);
    try {
      const res = await fetch("/api/kanban", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memindahkan task.");
      setTasks((prev) => prev.map((item) => (item.id === data.task.id ? data.task : item)));
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const createTask = async () => {
    if (!form.title.trim()) { setMessage("Judul task wajib diisi."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/kanban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal membuat task.");
      setTasks((prev) => [data.task, ...prev]);
      setForm({ title: "", category: form.category, priority: "normal", dueDate: "", notes: "" });
      setShowForm(false);
      setMessage(`Task #${data.task.id} dibuat.`);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 fade-in-up">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">Kanban Task</h1>
          <p className="mt-1 text-xs text-muted-foreground md:text-sm">Board langsung dari Taskwork DB — sinkron dengan task Hermes/Telegram.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowForm((s) => !s)} className="gap-1.5 text-xs">
            {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} {showForm ? "Tutup" : "Task baru"}
          </Button>
        </div>
      </div>

      {message && <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">{message}</div>}

      {showForm && (
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm">Task Baru</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Judul task" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
                <option value="work">work</option><option value="personal">personal</option><option value="bisnis">bisnis</option>
              </select>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
                <option value="low">low</option><option value="normal">normal</option><option value="high">high</option><option value="urgent">urgent</option>
              </select>
              <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
            </div>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Catatan (opsional)" className="min-h-[70px] text-sm" />
            <Button size="sm" onClick={() => void createTask()} disabled={saving} className="gap-1.5 text-xs">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Simpan ke Taskwork
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {(["semua", "work", "personal", "bisnis"] as const).map((item) => (
          <Button key={item} size="sm" variant={category === item ? "default" : "outline"} onClick={() => setCategory(item)} className="text-xs">{item}</Button>
        ))}
      </div>

      {loading && tasks.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat board…</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((column) => {
            const items = visible.filter((task) => task.status === column.id);
            return (
              <Card key={column.id} className="flex flex-col">
                <CardHeader className="py-3">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><KanbanSquare className="h-4 w-4 text-primary" /> {column.label}</span>
                    <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 space-y-2">
                  {items.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">Kosong.</p>
                  ) : items.map((task) => (
                    <div key={task.id} className="rounded-xl border border-border bg-background/60 p-2.5">
                      <p className="text-xs font-medium leading-snug">{task.title}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        <Badge variant="outline" className={cn("text-[9px]", CATEGORY_STYLE[task.category])}>{task.category}</Badge>
                        <Badge variant="outline" className={cn("text-[9px]", PRIORITY_STYLE[task.priority])}>{task.priority}</Badge>
                        {task.dueDate && <span className="flex items-center gap-1 text-[9px] text-muted-foreground"><CalendarDays className="h-2.5 w-2.5" />{task.dueDate}</span>}
                        <span className="text-[9px] text-muted-foreground">#{task.id}</span>
                      </div>
                      {task.notes && <p className="mt-1.5 line-clamp-2 text-[10px] text-muted-foreground">{task.notes}</p>}
                      <div className="mt-2 flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 flex-1 px-1 text-[10px]" disabled={busyId === task.id || column.id === COLUMNS[0].id} onClick={() => void move(task, -1)}>
                          <ChevronLeft className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 flex-1 px-1 text-[10px]" disabled={busyId === task.id || column.id === COLUMNS[COLUMNS.length - 1].id} onClick={() => void move(task, 1)}>
                          {busyId === task.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronRight className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">Perubahan langsung tersimpan ke Taskwork DB dan tercatat di task_events, jadi terlihat juga dari Hermes.</p>
    </div>
  );
}
