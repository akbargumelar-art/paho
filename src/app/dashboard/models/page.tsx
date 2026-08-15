"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock3, Cpu, Loader2, RefreshCw, Search, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Health = { model: string; status: "healthy" | "slow" | "failed"; latencyMs: number | null; checkedAt: string; note?: string };
type Model = { id: string; family: string; featured: boolean; health?: Health | null };

function statusIcon(status?: Health["status"] | null) {
  if (status === "healthy") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (status === "slow") return <Clock3 className="h-3.5 w-3.5 text-amber-500" />;
  if (status === "failed") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  return <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />;
}

function statusLabel(status?: Health["status"] | null) {
  if (status === "healthy") return "sehat";
  if (status === "slow") return "lambat";
  if (status === "failed") return "gagal";
  return "belum dicek";
}

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("semua");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/chat/models");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memuat model.");
      setModels(Array.isArray(data.models) ? data.models : []);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const families = useMemo(() => ["semua", ...Array.from(new Set(models.map((m) => m.family))).sort()], [models]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return models.filter((m) => {
      if (family !== "semua" && m.family !== family) return false;
      if (q && !m.id.toLowerCase().includes(q) && !m.family.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [models, query, family]);

  const counts = useMemo(() => ({
    total: models.length,
    healthy: models.filter((m) => m.health?.status === "healthy").length,
    slow: models.filter((m) => m.health?.status === "slow").length,
    failed: models.filter((m) => m.health?.status === "failed").length,
    unchecked: models.filter((m) => !m.health).length,
  }), [models]);

  const checkModels = async (ids: string[]) => {
    if (ids.length === 0) return;
    setChecking(true);
    setMessage(`Mengecek ${ids.length} model...`);
    try {
      const res = await fetch("/api/chat/models/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ models: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal cek model.");
      await load();
      const failed = (data.results || []).filter((r: Health) => r.status === "failed").length;
      setMessage(`Selesai cek ${data.results?.length || ids.length} model${failed ? `, ${failed} gagal` : ""}.`);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const featured = models.filter((m) => m.featured).slice(0, 12).map((m) => m.id);

  return (
    <div className="space-y-5 fade-in-up">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">Model Management</h1>
          <p className="mt-1 text-xs text-muted-foreground md:text-sm">Daftar model dari 9Router + health check agar picker chat tidak memilih model macet.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading || checking} className="gap-1.5 text-xs">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
          </Button>
          <Button size="sm" onClick={() => void checkModels(featured)} disabled={checking || featured.length === 0} className="gap-1.5 text-xs">
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cpu className="h-3.5 w-3.5" />} Cek unggulan
          </Button>
        </div>
      </div>

      {message && <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">{message}</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Total", counts.total], ["Sehat", counts.healthy], ["Lambat", counts.slow], ["Gagal", counts.failed], ["Belum dicek", counts.unchecked],
        ].map(([label, value]) => (
          <Card key={String(label)}><CardContent className="p-3"><p className="text-[10px] uppercase text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-sm"><Search className="h-4 w-4 text-primary" /> Filter</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari model..." className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
          <select value={family} onChange={(e) => setFamily(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
            {families.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            <Cpu className="h-4 w-4 text-sky-400" /> Model
            <Badge variant="outline" className="text-[10px]">{filtered.length} tampil</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat model…</div> : (
            <div className="space-y-2">
              {filtered.map((model) => (
                <div key={model.id} className="flex flex-col gap-2 rounded-xl border border-border bg-background/50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {statusIcon(model.health?.status)}
                      <span className="truncate font-mono text-xs font-medium">{model.id}</span>
                      {model.featured && <Badge className="text-[10px]">unggulan</Badge>}
                      <Badge variant="outline" className="text-[10px]">{model.family}</Badge>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {statusLabel(model.health?.status)}
                      {model.health?.latencyMs != null ? ` · ${model.health.latencyMs}ms` : ""}
                      {model.health?.checkedAt ? ` · ${new Date(model.health.checkedAt).toLocaleString("id-ID")}` : ""}
                      {model.health?.note ? ` · ${model.health.note}` : ""}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void checkModels([model.id])} disabled={checking} className="shrink-0 text-xs">Cek</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[10px] text-muted-foreground">Health check mengirim prompt kecil ke model. Model lambat/gagal tidak dihapus, hanya diberi tanda agar kamu tahu sebelum memilih di chat.</p>
    </div>
  );
}
