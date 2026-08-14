"use client"

import { useEffect, useMemo, useState } from "react"
import { useAppStore } from "@/lib/store"
import type { Domain, Reminder } from "@/lib/mock-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DomainBadge } from "@/components/shared/domain-badge"
import { OwnerBadge } from "@/components/shared/owner-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { Bell, X, Copy } from "lucide-react"
import { ActionToast, type ActionToastState } from "@/components/shared/action-toast"

type ReminderView = Reminder & {
  sourceType?: string
  responsePreview?: string
  outputPath?: string
  jobId?: string
}

export default function ReminderCenterPage() {
  const { reminders, reminderHistory } = useAppStore()
  const [filterDomain, setFilterDomain] = useState<Domain | "all">("all")
  const [filterSource, setFilterSource] = useState<string>("all")
  const [selectedReminder, setSelectedReminder] = useState<ReminderView | null>(null)
  const [toast, setToast] = useState<ActionToastState>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const active = useMemo(() => (reminders as ReminderView[]).filter((r) => {
    if (filterDomain !== "all" && r.domain !== filterDomain) return false
    if (filterSource !== "all" && r.sourceType !== filterSource) return false
    return true
  }), [reminders, filterDomain, filterSource])

  const history = useMemo(() => (reminderHistory as ReminderView[]).filter((r) => {
    if (filterDomain !== "all" && r.domain !== filterDomain) return false
    if (filterSource !== "all" && r.sourceType !== filterSource) return false
    return true
  }), [reminderHistory, filterDomain, filterSource])

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setToast({ type: "success", message: "Berhasil disalin ke clipboard." })
    } catch {
      setToast({ type: "error", message: "Gagal menyalin ke clipboard." })
    }
  }

  const Table = ({ items, title }: { items: ReminderView[]; title: string }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base"><Bell className="w-5 h-5 text-primary" /> {title}</CardTitle>
        <Badge variant="outline" className="text-[11px]">{items.length}</Badge>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reminder</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Waktu</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Domain</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Owner</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Source</th>
              </tr>
            </thead>
            <tbody>
              {items.map((rem) => (
                <tr key={rem.id} onClick={() => setSelectedReminder(rem)} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm">{rem.title}</p>
                    {rem.responsePreview && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{rem.responsePreview}</p>}
                  </td>
                  <td className="px-4 py-3"><span className="text-sm text-muted-foreground">{rem.triggerTime || '-'}</span></td>
                  <td className="px-4 py-3"><DomainBadge domain={rem.domain} /></td>
                  <td className="px-4 py-3"><StatusBadge status={rem.status} /></td>
                  <td className="px-4 py-3"><OwnerBadge owner={rem.owner} /></td>
                  <td className="px-4 py-3"><Badge variant="outline" className="text-[11px]">{rem.sourceType || 'live-store'}</Badge></td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">Kosong</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6 fade-in-up">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Reminder Center</h1>
        <p className="text-muted-foreground text-xs md:text-sm mt-1">Pusat reminder aktif, runtime, dan historis dari Hermes.</p>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex gap-3 flex-wrap">
            {(["all", "personal", "business", "work"] as const).map(d => (
              <button key={d} onClick={() => setFilterDomain(d)} className={`px-3 py-1.5 rounded-md text-xs font-medium ${filterDomain===d?'bg-primary text-primary-foreground':'bg-muted text-muted-foreground'}`}>{d}</button>
            ))}
            <div className="w-px h-6 bg-border" />
            {(["all", "live-store", "hermes-cron", "hermes-cron-output"] as const).map(s => (
              <button key={s} onClick={() => setFilterSource(s)} className={`px-3 py-1.5 rounded-md text-xs font-medium ${filterSource===s?'bg-primary text-primary-foreground':'bg-muted text-muted-foreground'}`}>{s}</button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Table items={active} title="Reminder Aktif & Runtime" />
      <Table items={history} title="Reminder History" />

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Bell className="w-5 h-5 text-primary" /> Timeline Reminder History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {history.slice(0, 12).map((rem) => (
                <div key={`timeline-${rem.id}`} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-primary mt-1" />
                    <div className="w-px flex-1 bg-border mt-2" />
                  </div>
                  <div className="flex-1 rounded-xl border border-border bg-muted/20 p-3 cursor-pointer" onClick={() => setSelectedReminder(rem)}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-medium text-sm">{rem.title}</p>
                      <span className="text-xs text-muted-foreground">{rem.triggerTime || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      <DomainBadge domain={rem.domain} />
                      <StatusBadge status={rem.status} />
                      <Badge variant="outline" className="text-[11px]">{rem.sourceType || 'live-store'}</Badge>
                    </div>
                    {rem.responsePreview && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{rem.responsePreview}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedReminder && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={() => setSelectedReminder(null)}>
          <div className="w-full max-w-lg bg-card border-l border-border shadow-2xl h-full overflow-y-auto slide-in-right" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-card/80 backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between">
              <h3 className="font-semibold">Detail Reminder</h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedReminder(null)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3 flex-wrap">
                <StatusBadge status={selectedReminder.status} />
                <DomainBadge domain={selectedReminder.domain} />
                <OwnerBadge owner={selectedReminder.owner} />
                <Badge variant="outline" className="text-[11px]">{selectedReminder.sourceType || 'live-store'}</Badge>
              </div>
              <div><p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Judul</p><p className="text-sm font-medium">{selectedReminder.title}</p></div>
              {'jobId' in selectedReminder && selectedReminder.jobId && <div><p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Job ID</p><div className="flex gap-2"><p className="text-sm font-mono break-all flex-1">{selectedReminder.jobId}</p><Button variant="outline" size="sm" onClick={() => copyText(selectedReminder.jobId || '')}><Copy className="w-3 h-3" /></Button></div></div>}
              {'outputPath' in selectedReminder && selectedReminder.outputPath && <div><p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Output Path</p><div className="flex gap-2"><p className="text-sm font-mono break-all flex-1">{selectedReminder.outputPath}</p><Button variant="outline" size="sm" onClick={() => copyText(selectedReminder.outputPath || '')}><Copy className="w-3 h-3" /></Button></div></div>}
              {selectedReminder.responsePreview && <div><p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Preview</p><div className="bg-muted rounded-lg p-3 text-sm whitespace-pre-wrap break-words">{String(selectedReminder.responsePreview).replaceAll(' | ', '\n')}</div><div className="flex justify-end mt-2"><Button variant="outline" size="sm" onClick={() => copyText(String(selectedReminder.responsePreview).replaceAll(' | ', '\n'))}><Copy className="w-3 h-3 mr-1" /> Copy Preview</Button></div></div>}
            </div>
          </div>
        </div>
      )}

      <ActionToast toast={toast} />
    </div>
  )
}
