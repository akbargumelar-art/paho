"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, RefreshCw, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";

type Output = { id: string; jobId: string; jobName: string; file: string; createdAt: string; size: number; preview: string };
type Job = { id: string; name: string; enabled: boolean; schedule: string; lastRunAt?: string | null; nextRunAt?: string | null; lastStatus?: string | null };

export default function OutputsPage() {
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/outputs?limit=50", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memuat output.");
      setOutputs(data.outputs || []);
      setJobs(data.jobs || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-5 fade-in-up">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">Output Center</h1>
          <p className="mt-1 text-xs text-muted-foreground md:text-sm">Rumah hasil kerja Paho: sumber utama dari Hermes cron output, bukan history Group Chat.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading} className="gap-1.5 text-xs"><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
      </div>

      {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        <Card>
          <CardHeader className="py-3"><CardTitle className="flex items-center gap-2 text-sm"><Timer className="h-4 w-4 text-primary" /> Cron Jobs</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {jobs.map((job) => (
              <div key={job.id} className="rounded-lg border border-border p-3 text-xs">
                <div className="flex items-center justify-between gap-2"><span className="font-medium truncate">{job.name}</span><Badge variant={job.enabled ? "default" : "outline"} className="text-[9px]">{job.enabled ? "aktif" : "pause"}</Badge></div>
                <div className="mt-1 text-[10px] text-muted-foreground">{job.schedule || "schedule tidak ada"}</div>
                {job.lastRunAt && <div className="mt-1 text-[10px] text-muted-foreground">last: {new Date(job.lastRunAt).toLocaleString("id-ID")}</div>}
              </div>
            ))}
            {jobs.length === 0 && !loading && <p className="text-xs text-muted-foreground">Belum ada cron job.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3"><CardTitle className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-primary" /> Output Terbaru</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {loading && <p className="text-xs text-muted-foreground">Memuat output…</p>}
            {outputs.map((out) => (
              <div key={out.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground"><Badge variant="outline" className="text-[9px]">{out.jobName}</Badge><span>{new Date(out.createdAt).toLocaleString("id-ID")}</span><span>{Math.round(out.size/1024)} KB</span></div>
                <p className="mt-2 text-xs whitespace-pre-wrap">{out.preview || "[SILENT]"}</p>
              </div>
            ))}
            {outputs.length === 0 && !loading && <p className="text-xs text-muted-foreground">Belum ada output cron yang bisa ditampilkan.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
