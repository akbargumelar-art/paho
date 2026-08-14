"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Brain, Boxes, Loader2, PlugZap, RefreshCw, Sparkles, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { HermesNavTabs } from "@/components/shared/hermes-nav-tabs";

type ManagerData = {
  profile: string;
  skills: string;
  plugins: string;
  mcp: string;
  memoryStatus: string;
  memory: string;
};

const profiles = ["default", "all", "gadis", "priska", "bunga"];

function apiProfile(profile: string) {
  if (profile === "default") return "";
  if (profile === "all") return "__all__";
  return profile;
}

function Output({ value, empty = "Belum ada data." }: { value?: string; empty?: string }) {
  return <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border bg-slate-950/60 p-3 text-xs leading-relaxed">{value || empty}</pre>;
}

export default function HermesManagerPage() {
  const [profile, setProfile] = useState("default");
  const [data, setData] = useState<ManagerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState("");
  const [target, setTarget] = useState("");
  const [skillName, setSkillName] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (nextProfile = profile) => {
    setLoading(true);
    setError("");
    try {
      const viewProfile = nextProfile === "all" ? "default" : nextProfile;
      const qs = viewProfile === "default" ? "" : `?profile=${encodeURIComponent(viewProfile)}`;
      const res = await fetch(`/api/hermes/manager${qs}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Gagal memuat Hermes Manager.");
      setData(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { void load(profile); }, [load, profile]);

  const runAction = async (action: string) => {
    if (!target.trim()) return setError("Isi skill/plugin/MCP target dulu.");
    if (["skill-uninstall", "plugin-remove"].includes(action) && !confirm(`Yakin jalankan ${action} untuk ${target}?`)) return;
    setActing(action);
    setError("");
    setResult("");
    try {
      const res = await fetch("/api/hermes/manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, target: target.trim(), profile: apiProfile(profile) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Aksi gagal.");
      setResult(body.output || "Selesai.");
      await load(profile);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActing("");
    }
  };

  const uploadSkillMd = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".md")) return setError("File skill harus .md");
    setActing("skill-upload-md");
    setError("");
    setResult("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", skillName.trim());
      form.append("profile", apiProfile(profile));
      const res = await fetch("/api/hermes/manager", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Upload skill gagal.");
      setResult(body.output || `Skill ${body.skillName || file.name} berhasil diupload.`);
      setSkillName("");
      await load(profile);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActing("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-5 fade-in-up">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2"><Boxes className="h-5 w-5 text-primary" /><h1 className="text-xl font-bold md:text-2xl">Hermes Manager</h1></div>
          <p className="mt-1 text-sm text-muted-foreground">Kelola Skills, Memory, Plugins/Add-ons, dan MCP per profile Hermes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HermesNavTabs />
          <select value={profile} onChange={(event) => setProfile(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            {profiles.map((item) => <option key={item} value={item}>{item === "all" ? "all agents" : item}</option>)}
          </select>
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><PlugZap className="h-4 w-4" /> Install / Manage</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input value={target} onChange={(event) => setTarget(event.target.value)} placeholder="Skill hub ID / URL / plugin package / MCP server name" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void runAction("skill-install")} disabled={!!acting}>{acting === "skill-install" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Install Skill</Button>
            <Button size="sm" variant="outline" onClick={() => void runAction("skill-uninstall")} disabled={!!acting}>Uninstall Skill</Button>
            <Button size="sm" onClick={() => void runAction("plugin-install")} disabled={!!acting}>Install Plugin</Button>
            <Button size="sm" variant="outline" onClick={() => void runAction("plugin-remove")} disabled={!!acting}>Remove Plugin</Button>
            <Button size="sm" variant="outline" onClick={() => void runAction("mcp-test")} disabled={!!acting}>Test MCP</Button>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 text-sm font-medium">Upload skill .md lokal</div>
            <div className="flex flex-col gap-2 md:flex-row">
              <Input value={skillName} onChange={(event) => setSkillName(event.target.value)} placeholder="Nama skill opsional, contoh: antigravity-ideas" />
              <input ref={fileInputRef} type="file" className="hidden" accept=".md,text/markdown,text/plain" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadSkillMd(file); }} />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={!!acting}><Upload className="mr-2 h-4 w-4" />Upload .md</Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Jika file belum punya frontmatter Hermes, Paho akan menambahkan frontmatter dasar otomatis lalu menyimpan sebagai SKILL.md.</p>
          </div>
          {result && <Output value={result} />}
          <p className="text-xs text-muted-foreground">Install/remove memakai CLI resmi Hermes. Tool/skill changes biasanya aktif pada session baru atau setelah gateway restart terkontrol.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" /> Skills <Badge variant="secondary">{profile}</Badge></CardTitle></CardHeader><CardContent><Output value={loading ? "Memuat..." : data?.skills} /></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><PlugZap className="h-4 w-4" /> Plugins / Add-ons</CardTitle></CardHeader><CardContent><Output value={loading ? "Memuat..." : data?.plugins} /></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Brain className="h-4 w-4" /> Memory</CardTitle></CardHeader><CardContent className="space-y-3"><Output value={loading ? "Memuat..." : data?.memoryStatus} /><Output value={loading ? "Memuat..." : data?.memory} empty="Memory kosong." /></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Boxes className="h-4 w-4" /> MCP Servers</CardTitle></CardHeader><CardContent><Output value={loading ? "Memuat..." : data?.mcp} /></CardContent></Card>
      </div>
    </div>
  );
}
