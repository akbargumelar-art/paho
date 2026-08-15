"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, AlertTriangle, Clock, XCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Alert = {
  id: string;
  kind: "task" | "reminder" | "cron";
  severity: "overdue" | "soon" | "failed";
  title: string;
  source: string;
  dueAt: string | null;
  relative: string;
  href: string;
  detail?: string;
};

type AlertsResponse = {
  counts: { total: number; overdue: number; soon: number; failed: number };
  alerts: Alert[];
  soonWindowHours: number;
  sourceErrors: { source: string; error: string }[];
};

const SEVERITY = {
  overdue: { icon: AlertTriangle, label: "Lewat batas", cls: "text-destructive" },
  failed: { icon: XCircle, label: "Bermasalah", cls: "text-amber-500" },
  soon: { icon: Clock, label: "Mendekati", cls: "text-primary" },
} as const;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alerts", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {
      // leave previous data in place; the panel shows a fallback message
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 120000);
    return () => window.clearInterval(timer);
  }, [load]);

  // Close on outside click / Escape so the panel never traps the user on mobile.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const counts = data?.counts;
  const urgent = (counts?.overdue || 0) + (counts?.failed || 0);
  const badge = counts?.total || 0;

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-10 w-10 rounded-full md:h-9 md:w-9 md:rounded-md"
        aria-label={`Notifikasi${badge ? `: ${badge} item` : ""}`}
        aria-expanded={open}
        onClick={() => { setOpen((s) => !s); if (!open) void load(); }}
      >
        <Bell className="h-4 w-4" />
        {badge > 0 && (
          <span className={cn(
            "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
            urgent > 0 ? "bg-destructive text-destructive-foreground glow-pulse" : "bg-primary text-primary-foreground"
          )}>
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </Button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-50 max-h-[70dvh] overflow-hidden rounded-xl border border-border bg-card shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[380px]">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Notifikasi</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {counts
                  ? `${counts.overdue} lewat batas · ${counts.soon} mendekati · ${counts.failed} bermasalah`
                  : "memuat…"}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => void load()} aria-label="Muat ulang">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
          </div>

          <div className="max-h-[calc(70dvh-84px)] overflow-y-auto">
            {!data ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">Memuat notifikasi…</p>
            ) : data.alerts.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                Tidak ada deadline yang mendekati atau terlewat dalam {data.soonWindowHours} jam ke depan.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {data.alerts.map((alert) => {
                  const meta = SEVERITY[alert.severity];
                  const Icon = meta.icon;
                  return (
                    <li key={alert.id}>
                      <Link
                        href={alert.href}
                        onClick={() => setOpen(false)}
                        className="flex gap-2.5 px-3 py-2.5 transition hover:bg-accent/60"
                      >
                        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.cls)} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium leading-snug">{alert.title}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            <span className={meta.cls}>{alert.relative}</span> · {alert.source}
                          </p>
                          {alert.detail && (
                            <p className="mt-0.5 break-words text-[10px] text-muted-foreground/80">{alert.detail}</p>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            {Boolean(data?.sourceErrors?.length) && (
              <div className="border-t border-border bg-muted/40 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">
                  Sumber tidak terbaca: {data?.sourceErrors.map((e) => e.source).join(", ")}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
