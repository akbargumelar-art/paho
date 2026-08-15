"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, ShieldCheck, TerminalSquare, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Command = { name: string; description: string };
type Entry = { id: string; command: string; stdout: string; stderr: string; exitCode: number; durationMs: number; timedOut: boolean };

export default function ConsolePage() {
  const [commands, setCommands] = useState<Command[]>([]);
  const [selected, setSelected] = useState("pm2-status");
  const [argInput, setArgInput] = useState("");
  const [history, setHistory] = useState<Entry[]>([]);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/console");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memuat daftar perintah.");
      setCommands(data.commands || []);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history]);

  const run = async () => {
    setRunning(true);
    setMessage("");
    try {
      const args = argInput.trim() ? argInput.trim().split(/\s+/) : [];
      const res = await fetch("/api/console", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: selected, args }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Perintah gagal.");
      setHistory((prev) => [...prev.slice(-19), { id: `${Date.now()}`, ...data }]);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const current = commands.find((c) => c.name === selected);

  return (
    <div className="space-y-5 fade-in-up">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">Console Aman</h1>
          <p className="mt-1 text-xs text-muted-foreground md:text-sm">Perintah read-only pilihan untuk cek status server dari HP.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setHistory([])} disabled={history.length === 0} className="gap-1.5 text-xs">
          <Trash2 className="h-3.5 w-3.5" /> Bersihkan
        </Button>
      </div>

      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-300">
        <ShieldCheck className="mr-1 inline h-3.5 w-3.5" /> Bukan shell. Tanpa pipe/redirect/sudo. Hanya {commands.length} perintah baca-saja yang diizinkan.
      </div>
      {message && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{message}</div>}

      <Card>
        <CardHeader className="py-3"><CardTitle className="flex items-center gap-2 text-sm"><TerminalSquare className="h-4 w-4 text-primary" /> Jalankan</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[240px_1fr_auto]">
            <select value={selected} onChange={(e) => { setSelected(e.target.value); setArgInput(""); }} className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
              {commands.map((command) => <option key={command.name} value={command.name}>{command.name}</option>)}
            </select>
            <input value={argInput} onChange={(e) => setArgInput(e.target.value)} placeholder="argumen (opsional)"
              onKeyDown={(e) => { if (e.key === "Enter" && !running) void run(); }}
              className="h-10 rounded-lg border border-input bg-background px-3 font-mono text-xs" />
            <Button size="sm" onClick={() => void run()} disabled={running} className="h-10 gap-1.5 text-xs">
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Run
            </Button>
          </div>
          {current && <p className="text-[11px] text-muted-foreground">{current.description}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-sm">Output <Badge variant="outline" className="text-[10px]">{history.length}</Badge></CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? <p className="text-xs text-muted-foreground">Belum ada perintah dijalankan.</p> : (
            <div className="max-h-[56vh] space-y-3 overflow-auto">
              {history.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-border bg-background/60 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-medium">$ {entry.command}</span>
                    <Badge variant="outline" className={cn("text-[9px]", entry.exitCode === 0 ? "border-emerald-500/40 text-emerald-500" : "border-destructive/40 text-destructive")}>
                      exit {entry.exitCode}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{entry.durationMs}ms</span>
                    {entry.timedOut && <Badge variant="outline" className="border-amber-500/40 text-[9px] text-amber-500">timeout</Badge>}
                  </div>
                  {entry.stdout && <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted p-2 text-[10px] leading-relaxed"><code>{entry.stdout}</code></pre>}
                  {entry.stderr && <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-destructive/10 p-2 text-[10px] leading-relaxed text-destructive"><code>{entry.stderr}</code></pre>}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-sm">Perintah yang tersedia</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {commands.map((command) => (
            <div key={command.name} className="flex flex-col gap-0.5 border-b border-border pb-1.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-mono text-xs">{command.name}</span>
              <span className="text-[10px] text-muted-foreground">{command.description}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
