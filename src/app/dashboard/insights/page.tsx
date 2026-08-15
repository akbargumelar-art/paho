"use client";

import { useCallback, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, Loader2, MessageSquare, Cpu, AlertTriangle, RefreshCw,
  Palette, Sun, Moon, Monitor, Type, Rows3, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Summary = {
  threads: number; messages: number; userMessages: number; assistantMessages: number;
  errors: number; totalChars: number; estimatedTokens: number; oldest: string | null; newest: string | null;
};
type ModelRow = { model: string; responses: number; chars: number; estimatedTokens: number; share: number };
type Day = { date: string; messages: number; chars: number; estimatedTokens: number };
type Analytics = { summary: Summary; models: ModelRow[]; days: Day[]; methodology: string; costAvailable: boolean };

const ACCENTS = [
  { id: "violet", label: "Violet", swatch: "bg-violet-500" },
  { id: "sky", label: "Sky", swatch: "bg-sky-500" },
  { id: "emerald", label: "Emerald", swatch: "bg-emerald-500" },
  { id: "amber", label: "Amber", swatch: "bg-amber-500" },
  { id: "rose", label: "Rose", swatch: "bg-rose-500" },
];
const FONT_SIZES = [
  { id: "small", label: "Kecil" },
  { id: "normal", label: "Normal" },
  { id: "large", label: "Besar" },
  { id: "xlarge", label: "Ekstra" },
];

function fmt(n: number) {
  return n.toLocaleString("id-ID");
}

export default function InsightsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [accent, setAccent] = useState("violet");
  const [fontSize, setFontSize] = useState("normal");
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    setMounted(true);
    setAccent(localStorage.getItem("paho-accent") || "violet");
    setFontSize(localStorage.getItem("paho-font-size") || "normal");
    setCompact(localStorage.getItem("paho-compact") === "true");
  }, []);

  const applyPrefs = useCallback((next: { accent?: string; fontSize?: string; compact?: boolean }) => {
    if (next.accent !== undefined) { localStorage.setItem("paho-accent", next.accent); setAccent(next.accent); }
    if (next.fontSize !== undefined) { localStorage.setItem("paho-font-size", next.fontSize); setFontSize(next.fontSize); }
    if (next.compact !== undefined) { localStorage.setItem("paho-compact", String(next.compact)); setCompact(next.compact); }
    window.dispatchEvent(new Event("paho-preferences"));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/analytics");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Gagal memuat analytics.");
      setData(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const peak = Math.max(1, ...(data?.days || []).map((d) => d.messages));
  const activeDays = (data?.days || []).filter((d) => d.messages > 0).length;

  return (
    <div className="space-y-5 fade-in-up">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">Insights &amp; Tampilan</h1>
          <p className="mt-1 text-xs text-muted-foreground md:text-sm">Statistik pemakaian chat dan pengaturan tampilan Paho.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading} className="gap-1.5 text-xs">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}

      {/* Appearance */}
      <Card>
        <CardHeader className="py-3"><CardTitle className="flex items-center gap-2 text-sm"><Palette className="h-4 w-4 text-primary" /> Tampilan</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Mode warna</p>
            <div className="flex flex-wrap gap-2">
              {mounted && ([["dark", "Gelap", Moon], ["light", "Terang", Sun], ["system", "Sistem", Monitor]] as const).map(([id, label, Icon]) => (
                <Button key={id} type="button" size="sm" variant={theme === id ? "default" : "outline"} onClick={() => setTheme(id)} className="gap-1.5 text-xs">
                  <Icon className="h-3.5 w-3.5" /> {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Warna aksen</p>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((item) => (
                <button key={item.id} type="button" onClick={() => applyPrefs({ accent: item.id })}
                  className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition", accent === item.id ? "border-primary bg-primary/10" : "border-border hover:bg-accent")}>
                  <span className={cn("h-3 w-3 rounded-full", item.swatch)} />
                  {item.label}
                  {accent === item.id && <Check className="h-3 w-3" />}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Type className="h-3.5 w-3.5" /> Ukuran teks</p>
              <div className="flex flex-wrap gap-2">
                {FONT_SIZES.map((item) => (
                  <Button key={item.id} type="button" size="sm" variant={fontSize === item.id ? "default" : "outline"} onClick={() => applyPrefs({ fontSize: item.id })} className="text-xs">
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Rows3 className="h-3.5 w-3.5" /> Kerapatan</p>
              <Button type="button" size="sm" variant={compact ? "default" : "outline"} onClick={() => applyPrefs({ compact: !compact })} className="text-xs">
                {compact ? "Compact aktif" : "Normal"}
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">Preferensi tampilan disimpan di perangkat ini (localStorage), jadi tiap device bisa beda.</p>
        </CardContent>
      </Card>

      {loading && !data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat analytics…</div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Total chat", value: fmt(data.summary.threads), icon: MessageSquare },
              { label: "Total pesan", value: fmt(data.summary.messages), icon: BarChart3 },
              { label: "Est. token", value: fmt(data.summary.estimatedTokens), icon: Cpu },
              { label: "Gagal", value: fmt(data.summary.errors), icon: AlertTriangle },
            ].map((item) => (
              <Card key={item.label}>
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground"><item.icon className="h-3.5 w-3.5" /> {item.label}</div>
                  <div className="mt-1 text-xl font-bold md:text-2xl">{item.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                <Cpu className="h-4 w-4 text-sky-400" /> Pemakaian per Model
                <Badge variant="outline" className="text-[10px]">{data.models.length} model</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.models.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada jawaban assistant yang tercatat.</p>
              ) : (
                <div className="space-y-2">
                  {data.models.map((row) => (
                    <div key={row.model} className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{row.model}</span>
                        <span className="text-muted-foreground">{fmt(row.responses)} jawaban · ~{fmt(row.estimatedTokens)} token · {row.share}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, row.share)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                <BarChart3 className="h-4 w-4 text-emerald-400" /> Aktivitas 30 Hari
                <Badge variant="outline" className="text-[10px]">{activeDays} hari aktif</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-28 min-w-0 items-end gap-[2px] sm:gap-[3px]">
                {data.days.map((day) => (
                  <div key={day.date} className="group relative min-w-0 flex-1" title={`${day.date}: ${day.messages} pesan`}>
                    <div
                      className={cn("w-full rounded-t transition", day.messages > 0 ? "bg-primary/70 group-hover:bg-primary" : "bg-muted")}
                      style={{ height: `${Math.max(3, (day.messages / peak) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap justify-between gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                <span>{data.days[0]?.date}</span>
                <span>puncak {peak} pesan/hari</span>
                <span>{data.days[data.days.length - 1]?.date}</span>
              </div>
            </CardContent>
          </Card>

          <p className="text-[10px] text-muted-foreground">
            {data.methodology} Biaya per provider belum tersedia karena panggilan Hermes CLI tidak mengembalikan usage billing.
          </p>
        </>
      ) : null}
    </div>
  );
}
