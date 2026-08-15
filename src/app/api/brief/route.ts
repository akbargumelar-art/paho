import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { readBriefSettings } from "@/lib/brief-settings";

export const runtime = "nodejs";

const TASKWORK_DB = "/root/obsidian-vault/90 Hermes/Taskwork/taskwork.db";

type WeatherNow = { temperature: number; weatherCode: number; description: string; isDay: boolean } | null;
type PrayerTimes = Record<string, string> | null;
type AgendaItem = {
  id: number;
  title: string;
  category: string;
  priority: string;
  status: string;
  dueDate: string | null;
  createdAt: string | null;
  notes: string | null;
  /** Derived server-side so the UI does not re-implement date math. */
  overdue: boolean;
  dueToday: boolean;
};

const WEATHER_CODES: Record<number, string> = {
  0: "Cerah", 1: "Cerah berawan", 2: "Berawan sebagian", 3: "Berawan",
  45: "Berkabut", 48: "Kabut beku", 51: "Gerimis ringan", 53: "Gerimis", 55: "Gerimis lebat",
  61: "Hujan ringan", 63: "Hujan", 65: "Hujan lebat", 66: "Hujan beku", 67: "Hujan beku lebat",
  71: "Salju ringan", 73: "Salju", 75: "Salju lebat", 80: "Hujan lokal", 81: "Hujan lokal deras",
  82: "Hujan badai lokal", 95: "Badai petir", 96: "Badai petir + hujan es", 99: "Badai petir hebat",
};

async function fetchWeather(lat: number, lon: number, tz: string): Promise<{ now: WeatherNow; daily: unknown }> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,weather_code` +
    `&timezone=${encodeURIComponent(tz)}&forecast_days=1`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`weather ${res.status}`);
  const data = await res.json();
  const code = Number(data?.current?.weather_code ?? -1);
  return {
    now: {
      temperature: Number(data?.current?.temperature_2m),
      weatherCode: code,
      description: WEATHER_CODES[code] || "—",
      isDay: Boolean(data?.current?.is_day),
    },
    daily: {
      max: data?.daily?.temperature_2m_max?.[0] ?? null,
      min: data?.daily?.temperature_2m_min?.[0] ?? null,
      code: data?.daily?.weather_code?.[0] ?? null,
    },
  };
}

async function fetchPrayer(lat: number, lon: number, method: number): Promise<PrayerTimes> {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const url = `https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?latitude=${lat}&longitude=${lon}&method=${method}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`prayer ${res.status}`);
  const data = await res.json();
  const t = data?.data?.timings || {};
  const pick = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
  const out: Record<string, string> = {};
  for (const k of pick) if (t[k]) out[k] = String(t[k]).slice(0, 5);
  return out;
}

/** Local YYYY-MM-DD; using toISOString() here would shift the day in UTC+7. */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function readAgendaAsync(): Promise<{ agenda: AgendaItem[]; pending: number; done: number }> {
  const db = createClient({ url: `file:${TASKWORK_DB}` });
  try {
    const today = localToday();
    // Today's agenda = open tasks due today or earlier (or undated), PLUS
    // anything already completed today so the checklist shows what is done.
    const rows = await db.execute({
      sql: `SELECT id, title, category, priority, status, due_date as dueDate, created_at as createdAt, notes
       FROM tasks
       WHERE (
               status IN ('todo','in_progress')
               AND (due_date IS NULL OR date(due_date) <= date(?))
             )
          OR (status = 'done' AND date(COALESCE(completed_at, updated_at)) = date(?))
       ORDER BY
         CASE status WHEN 'done' THEN 1 ELSE 0 END,
         (due_date IS NULL), date(due_date) ASC,
         CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END
       LIMIT 40`,
      args: [today, today],
    });
    const agenda = rows.rows.map((r) => {
      const dueDate = r.dueDate === null ? null : String(r.dueDate);
      const dueDay = dueDate ? dueDate.slice(0, 10) : null;
      return {
        id: Number(r.id),
        title: String(r.title),
        category: String(r.category),
        priority: String(r.priority),
        status: String(r.status),
        dueDate,
        createdAt: r.createdAt === null ? null : String(r.createdAt),
        notes: r.notes === null ? null : String(r.notes),
        overdue: Boolean(dueDay && dueDay < today && String(r.status) !== "done"),
        dueToday: Boolean(dueDay && dueDay === today),
      };
    }) as AgendaItem[];
    const countRes = await db.execute(`SELECT COUNT(*) as c FROM tasks WHERE status IN ('todo','in_progress')`);
    const doneRes = await db.execute({
      sql: `SELECT COUNT(*) as c FROM tasks WHERE status = 'done' AND date(COALESCE(completed_at, updated_at)) = date(?)`,
      args: [today],
    });
    return {
      agenda,
      pending: Number(countRes.rows[0]?.c ?? 0),
      done: Number(doneRes.rows[0]?.c ?? 0),
    };
  } finally {
    db.close();
  }
}

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const settings = await readBriefSettings();
  const configured = settings.latitude !== null && settings.longitude !== null;

  const result: Record<string, unknown> = {
    settings,
    configured,
    date: new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: settings.timezone }),
    weather: null,
    weatherError: null,
    prayer: null,
    prayerError: null,
    agenda: [],
    pendingTasks: 0,
    doneToday: 0,
    agendaError: null,
  };

  if (settings.showAgenda) {
    try {
      const { agenda, pending, done } = await readAgendaAsync();
      result.agenda = agenda;
      result.pendingTasks = pending;
      result.doneToday = done;
    } catch (e) {
      // Surface the real reason instead of silently showing an empty agenda.
      result.agendaError = (e as Error).message;
    }
  }

  if (configured) {
    const lat = settings.latitude as number;
    const lon = settings.longitude as number;
    const jobs: Promise<void>[] = [];
    if (settings.showWeather) {
      jobs.push(
        fetchWeather(lat, lon, settings.timezone)
          .then((w) => { result.weather = w; })
          .catch((e) => { result.weatherError = (e as Error).message; })
      );
    }
    if (settings.showPrayer) {
      jobs.push(
        fetchPrayer(lat, lon, settings.prayerMethod)
          .then((p) => { result.prayer = p; })
          .catch((e) => { result.prayerError = (e as Error).message; })
      );
    }
    await Promise.all(jobs);
  }

  return NextResponse.json(result);
}
