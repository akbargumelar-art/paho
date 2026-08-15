"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sun, CloudRain, Cloud, CloudSun, Moon, MapPin, RefreshCw, Settings2,
  CalendarDays, ListTodo, Clock, Loader2, Save, Search, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type BriefSettings = {
  locationName: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  prayerMethod: number;
  wakeTime: string;
  showWeather: boolean;
  showPrayer: boolean;
  showAgenda: boolean;
};

type AgendaItem = { id: number; title: string; category: string; priority: string; status: string; dueDate: string | null };
type Weather = { now: { temperature: number; description: string; weatherCode: number; isDay: boolean } | null; daily: { max: number; min: number } };
type BriefData = {
  settings: BriefSettings;
  configured: boolean;
  date: string;
  weather: Weather | null;
  weatherError: string | null;
  prayer: Record<string, string> | null;
  prayerError: string | null;
  agenda: AgendaItem[];
  pendingTasks: number;
  agendaError: string | null;
};

type GeoResult = { label: string; latitude: number; longitude: number; timezone: string };

const PRAYER_LABELS: Record<string, string> = {
  Fajr: "Subuh", Sunrise: "Terbit", Dhuhr: "Dzuhur", Asr: "Ashar", Maghrib: "Maghrib", Isha: "Isya",
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "text-red-500", high: "text-amber-500", normal: "text-sky-500", low: "text-muted-foreground",
};

function WeatherIcon({ code, isDay }: { code: number; isDay: boolean }) {
  if (code === 0) return isDay ? <Sun className="h-8 w-8 text-amber-400" /> : <Moon className="h-8 w-8 text-slate-300" />;
  if (code <= 2) return <CloudSun className="h-8 w-8 text-amber-300" />;
  if (code <= 48) return <Cloud className="h-8 w-8 text-slate-400" />;
  return <CloudRain className="h-8 w-8 text-sky-400" />;
}

export default function BriefPage() {
  const [data, setData] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  // settings form
  const [form, setForm] = useState<BriefSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [geoQuery, setGeoQuery] = useState("");
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/brief");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Gagal memuat brief.");
      setData(json);
      setForm(json.settings);
      if (!json.configured) setShowSettings(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const searchLocation = async () => {
    if (!geoQuery.trim()) return;
    setGeoLoading(true);
    try {
      const res = await fetch(`/api/brief/geocode?q=${encodeURIComponent(geoQuery)}`);
      const json = await res.json();
      setGeoResults(json.results || []);
    } finally {
      setGeoLoading(false);
    }
  };

  const pickLocation = (g: GeoResult) => {
    if (!form) return;
    setForm({ ...form, locationName: g.label, latitude: g.latitude, longitude: g.longitude, timezone: g.timezone });
    setGeoResults([]);
    setGeoQuery("");
  };

  const saveSettings = async () => {
    if (!form) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/brief/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Gagal menyimpan.");
      setShowSettings(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 11) return "Selamat pagi";
    if (h < 15) return "Selamat siang";
    if (h < 19) return "Selamat sore";
    return "Selamat malam";
  })();

  return (
    <div className="space-y-5 fade-in-up">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">{greeting}, abay 👋</h1>
          <p className="mt-1 text-xs text-muted-foreground md:text-sm">{data?.date || "Morning Brief"}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
          </Button>
          <Button size="sm" variant={showSettings ? "default" : "outline"} onClick={() => setShowSettings((s) => !s)} className="gap-1.5 text-xs">
            <Settings2 className="h-3.5 w-3.5" /> Setting
          </Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}

      {showSettings && form && (
        <Card className="border-sky-500/30">
          <CardHeader className="py-3"><CardTitle className="flex items-center gap-2 text-sm"><Settings2 className="h-4 w-4" /> Pengaturan Brief</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Lokasi (untuk cuaca &amp; waktu solat)</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={geoQuery} onChange={(e) => setGeoQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void searchLocation(); } }} placeholder="Cari kota, mis. Cirebon" className="flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={() => void searchLocation()} disabled={geoLoading} className="gap-1.5">
                  {geoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Cari
                </Button>
              </div>
              {geoResults.length > 0 && (
                <div className="max-h-48 space-y-1 overflow-auto rounded-lg border border-border p-1">
                  {geoResults.map((g, i) => (
                    <button key={i} type="button" onClick={() => pickLocation(g)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-sky-500" /> {g.label}
                    </button>
                  ))}
                </div>
              )}
              {form.locationName && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-sky-500" /> {form.locationName}
                  {form.latitude !== null && <span className="opacity-60">({form.latitude?.toFixed(2)}, {form.longitude?.toFixed(2)} · {form.timezone})</span>}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Waktu bangun / mulai hari</Label>
                <Input type="time" value={form.wakeTime} onChange={(e) => setForm({ ...form, wakeTime: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Metode waktu solat</Label>
                <select value={form.prayerMethod} onChange={(e) => setForm({ ...form, prayerMethod: Number(e.target.value) })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value={20}>Kemenag RI</option>
                  <option value={3}>Muslim World League</option>
                  <option value={2}>ISNA (Amerika Utara)</option>
                  <option value={4}>Umm al-Qura (Makkah)</option>
                  <option value={1}>Univ. Karachi</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {([["showWeather", "Cuaca"], ["showPrayer", "Waktu solat"], ["showAgenda", "Agenda &amp; tasks"]] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} className="h-4 w-4 rounded border-input" />
                  <span dangerouslySetInnerHTML={{ __html: label }} />
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowSettings(false)} className="gap-1.5"><X className="h-4 w-4" /> Tutup</Button>
              <Button size="sm" onClick={() => void saveSettings()} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && !data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat brief…</div>
      ) : data ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Weather */}
          {data.settings.showWeather && (
            <Card>
              <CardHeader className="py-3"><CardTitle className="flex items-center gap-2 text-sm"><CloudSun className="h-4 w-4 text-amber-400" /> Cuaca Hari Ini</CardTitle></CardHeader>
              <CardContent>
                {!data.configured ? (
                  <p className="text-xs text-muted-foreground">Atur lokasi dulu di Setting untuk melihat cuaca.</p>
                ) : data.weatherError ? (
                  <p className="text-xs text-destructive">Gagal ambil cuaca: {data.weatherError}</p>
                ) : data.weather?.now ? (
                  <div className="flex items-center gap-4">
                    <WeatherIcon code={data.weather.now.weatherCode} isDay={data.weather.now.isDay} />
                    <div>
                      <div className="text-3xl font-bold">{Math.round(data.weather.now.temperature)}°C</div>
                      <div className="text-xs text-muted-foreground">{data.weather.now.description}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">↑{Math.round(data.weather.daily.max)}° ↓{Math.round(data.weather.daily.min)}°</div>
                    </div>
                  </div>
                ) : <p className="text-xs text-muted-foreground">—</p>}
              </CardContent>
            </Card>
          )}

          {/* Prayer */}
          {data.settings.showPrayer && (
            <Card>
              <CardHeader className="py-3"><CardTitle className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4 text-emerald-400" /> Waktu Solat</CardTitle></CardHeader>
              <CardContent>
                {!data.configured ? (
                  <p className="text-xs text-muted-foreground">Atur lokasi dulu di Setting untuk melihat waktu solat.</p>
                ) : data.prayerError ? (
                  <p className="text-xs text-destructive">Gagal ambil waktu solat: {data.prayerError}</p>
                ) : data.prayer ? (
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(data.prayer).map(([k, v]) => (
                      <div key={k} className="rounded-lg border border-border bg-card/60 px-2 py-1.5 text-center">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{PRAYER_LABELS[k] || k}</div>
                        <div className="text-sm font-semibold">{v}</div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-muted-foreground">—</p>}
              </CardContent>
            </Card>
          )}

          {/* Agenda */}
          {data.settings.showAgenda && (
            <Card className="md:col-span-2">
              <CardHeader className="py-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CalendarDays className="h-4 w-4 text-sky-400" /> Agenda &amp; Tugas Hari Ini
                  <Badge variant="outline" className="ml-auto gap-1 text-[10px]"><ListTodo className="h-3 w-3" /> {data.pendingTasks} pending</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.agendaError ? (
                  <p className="text-xs text-destructive">Gagal baca agenda: {data.agendaError}</p>
                ) : data.agenda.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Tidak ada tugas untuk hari ini. 🎉</p>
                ) : (
                  <div className="space-y-2">
                    {data.agenda.map((t) => (
                      <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border bg-card/60 px-3 py-2">
                        <span className={cn("text-lg leading-none", PRIORITY_COLOR[t.priority] || "text-muted-foreground")}>•</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{t.title}</div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="uppercase">{t.category}</span>
                            {t.dueDate && <span>· jatuh tempo {t.dueDate}</span>}
                            {t.status === "in_progress" && <span className="text-amber-500">· berjalan</span>}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}
