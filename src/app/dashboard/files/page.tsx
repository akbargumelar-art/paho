"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Folder, FolderOpen, Loader2, RefreshCw, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

type Root = { id: string; label: string; path: string };
type Entry = { name: string; path: string; isDirectory: boolean; size: number; modified: string };
type Listing = { path: string; parent: string | null; entries: Entry[]; total: number };
type Preview = { path: string; size: number; modified: string; content: string; readOnly: boolean };

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function FileBrowserPage() {
  const [roots, setRoots] = useState<Root[]>([]);
  const [listing, setListing] = useState<Listing | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  const loadRoots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/files/browse");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memuat root.");
      setRoots(data.roots || []);
      if (!listing && data.roots?.[0]) void openPath(data.roots[0].path);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [listing]);

  const openPath = async (path: string) => {
    setLoading(true);
    setPreview(null);
    try {
      const res = await fetch(`/api/files/browse?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal membuka folder.");
      setListing(data);
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const readFile = async (path: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/files/browse?mode=read&path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal preview file.");
      setPreview(data);
      setMessage("");
    } catch (e) {
      setPreview(null);
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadRoots(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!listing) return [];
    return q ? listing.entries.filter((entry) => entry.name.toLowerCase().includes(q)) : listing.entries;
  }, [listing, query]);

  return (
    <div className="space-y-5 fade-in-up">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">File Browser</h1>
          <p className="mt-1 text-xs text-muted-foreground md:text-sm">Read-only explorer untuk folder yang diizinkan. Tidak bisa edit, hapus, atau akses secret.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => listing ? void openPath(listing.path) : void loadRoots()} disabled={loading} className="gap-1.5 text-xs">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-300">
        <Shield className="mr-1 inline h-3.5 w-3.5" /> Mode aman: hanya root allowlist, preview file teks ≤512 KB, blok .env/.git/node_modules/key/secret.
      </div>
      {message && <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">{message}</div>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm">Root</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {roots.map((root) => (
              <button key={root.id} type="button" onClick={() => void openPath(root.path)}
                className={cn("w-full rounded-lg border px-3 py-2 text-left text-xs transition", listing?.path.startsWith(root.path) ? "border-primary bg-primary/10" : "border-border hover:bg-accent")}> 
                <div className="flex items-center gap-2 font-medium"><FolderOpen className="h-3.5 w-3.5 text-primary" /> {root.label}</div>
                <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{root.path}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0 truncate font-mono text-xs">{listing?.path || "-"}</span>
              <Badge variant="outline" className="w-fit text-[10px]">{entries.length} item</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="sm" variant="outline" disabled={!listing?.parent || loading} onClick={() => listing?.parent && void openPath(listing.parent)} className="gap-1.5 text-xs">
                <ArrowLeft className="h-3.5 w-3.5" /> Naik
              </Button>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter nama file..." className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-xs" />
            </div>

            {loading && !listing ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</div> : (
              <div className="max-h-[52vh] overflow-auto rounded-lg border border-border">
                {entries.map((entry) => (
                  <button key={entry.path} type="button" onClick={() => entry.isDirectory ? void openPath(entry.path) : void readFile(entry.path)}
                    className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-xs last:border-b-0 hover:bg-accent">
                    {entry.isDirectory ? <Folder className="h-4 w-4 shrink-0 text-sky-400" /> : <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{entry.isDirectory ? "folder" : fmtSize(entry.size)}</span>
                    <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:block">{new Date(entry.modified).toLocaleDateString("id-ID")}</span>
                  </button>
                ))}
                {entries.length === 0 && <p className="p-4 text-xs text-muted-foreground">Kosong.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {preview && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0 truncate font-mono text-xs">{preview.path}</span>
              <span className="text-[10px] text-muted-foreground">{fmtSize(preview.size)} · read-only</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[56vh] overflow-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed"><code>{preview.content}</code></pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
