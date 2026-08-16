"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Database, FileText, Settings, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Promo = { id: string; provider: string; benefit: string; status_9router: string; source_url: string; first_seen: string; is_active: number; model_list: string };
type Report = { id: string; date: string; total_promos: number; new_promos: number; status: string };
type Source = { id: string; type: string; name: string; url: string; enabled: number; last_scraped_at: string };
type Setting = { key: string; value: string };

export default function BansosAIPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bansos-ai");
      const d = await res.json();
      if (d.promos) setPromos(d.promos);
      if (d.reports) setReports(d.reports);
      if (d.sources) setSources(d.sources);
      if (d.settings) setSettings(d.settings);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-5 fade-in-up">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">Bansos API AI</h1>
          <p className="mt-1 text-xs text-muted-foreground md:text-sm">Database hasil scraping promo & free tier API AI untuk Paho.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading} className="gap-1.5 text-xs"><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total Promo Aktif</p><p className="text-2xl font-bold mt-1 text-primary">{promos.filter(p=>p.is_active).length}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Support 9Router (Verified)</p><p className="text-2xl font-bold mt-1 text-emerald-500">{promos.filter(p=>p.status_9router==='verified').length}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Sumber Scraping</p><p className="text-2xl font-bold mt-1">{sources.filter(s=>s.enabled).length} Aktif</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Report Terakhir</p><p className="text-2xl font-bold mt-1">{reports[0]?.date || "-"}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="data" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="data" className="text-xs"><Database className="w-3.5 h-3.5 mr-1.5"/> Data Promo</TabsTrigger>
          <TabsTrigger value="reports" className="text-xs"><FileText className="w-3.5 h-3.5 mr-1.5"/> Laporan Harian</TabsTrigger>
          <TabsTrigger value="sources" className="text-xs"><Globe className="w-3.5 h-3.5 mr-1.5"/> Sumber Scraping</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs"><Settings className="w-3.5 h-3.5 mr-1.5"/> Pengaturan</TabsTrigger>
        </TabsList>
        
        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Hasil Scraping ({promos.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {promos.map(p => (
                  <div key={p.id} className="py-3 flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{p.provider}</span>
                        <Badge variant={p.status_9router==='verified'?'default':'secondary'} className="text-[9px]">{p.status_9router}</Badge>
                      </div>
                      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1">{p.benefit}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">Models: {p.model_list}</p>
                    </div>
                    <div className="text-right flex flex-col sm:items-end gap-1">
                      <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline">Lihat Sumber</a>
                      <span className="text-[10px] text-muted-foreground">{p.first_seen}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
           <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Riwayat Report Harian</CardTitle></CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {reports.map(r => (
                  <div key={r.id} className="py-2 flex justify-between items-center text-sm">
                    <span className="font-medium">{r.date}</span>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Total: {r.total_promos}</span>
                      <span className="text-emerald-500 font-medium">Baru: +{r.new_promos}</span>
                      <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="space-y-4">
           <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Konfigurasi Sumber</CardTitle></CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {sources.map(s => (
                  <div key={s.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{s.name} <Badge variant="outline" className="ml-2 text-[9px]">{s.type}</Badge></span>
                      <Badge variant={s.enabled?'default':'secondary'} className="text-[10px]">{s.enabled?'Aktif':'Mati'}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{s.url}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Last scraped: {s.last_scraped_at || 'Belum pernah'}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Parameter Scraping</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {settings.map(s => (
                  <div key={s.key} className="p-3 bg-muted/30 rounded-lg border border-border text-sm">
                    <span className="font-medium inline-block w-24 text-muted-foreground">{s.key}</span>
                    <span className="font-mono text-xs">{s.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
