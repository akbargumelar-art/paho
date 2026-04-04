"use client"

import { useState } from "react"
import { useAppStore } from "@/lib/store"
import type { ApprovalPath, JobStatus } from "@/lib/mock-data"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { OwnerBadge } from "@/components/shared/owner-badge"
import { RiskBadge } from "@/components/shared/risk-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { DomainBadge } from "@/components/shared/domain-badge"
import { ApprovalPathBadge } from "@/components/shared/approval-path-badge"
import { X, Filter, CornerDownLeft } from "lucide-react"
import { cn } from "@/lib/utils"

export default function JobsPage() {
  const jobs = useAppStore(s => s.jobs)
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<JobStatus | "all">("all")
  const [filterPath, setFilterPath] = useState<ApprovalPath | "all">("all")

  const filtered = jobs.filter(j => {
    if (filterStatus !== "all" && j.status !== filterStatus) return false
    if (filterPath !== "all" && j.approvalPath !== filterPath) return false
    return true
  })

  const detail = selectedJob ? jobs.find(j => j.id === selectedJob) : null

  return (
    <div className="space-y-6 fade-in-up">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Jobs & Handoff</h1>
        <p className="text-muted-foreground text-xs md:text-sm mt-1">Panel pemantauan pekerjaan OpenClaw dan delegasi dari Hermes</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <div className="flex gap-1">
              {(["all", "queued", "running", "waiting_approval", "done"] as const).map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors", filterStatus === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                  {s === "all" ? "Semua Status" : s === "queued" ? "Antrian" : s === "running" ? "Berjalan" : s === "waiting_approval" ? "Menunggu Approval" : "Selesai"}
                </button>
              ))}
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="flex gap-1">
              {(["all", "Telegram-safe", "Telegram-safe-with-review", "SSH-only", "OpenClaw-backend-only"] as const).map(p => (
                <button key={p} onClick={() => setFilterPath(p)} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors", filterPath === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                  {p === "all" ? "Semua Jalur" : p}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Job</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipe</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Domain</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Risiko</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Jalur Approval</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pemilik</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Return</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(job => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const j = job as any
                  const instruction = j.contextPack?.instruction ?? j.name ?? j.id
                  return (
                  <tr
                    key={job.id}
                    onClick={() => setSelectedJob(job.id)}
                    className={cn(
                      "border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer",
                      (job.riskLevel === "high" || job.riskLevel === "critical") && "border-l-2 border-l-destructive",
                      selectedJob === job.id && "bg-muted/50"
                    )}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm">{instruction}</p>
                      <p className="text-xs text-muted-foreground font-mono">{job.id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[11px] font-mono">{job.jobType ?? j.taskType ?? "cron"}</Badge>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                    <td className="px-4 py-3"><DomainBadge domain={job.domain} /></td>
                    <td className="px-4 py-3"><RiskBadge level={job.riskLevel} /></td>
                    <td className="px-4 py-3"><ApprovalPathBadge path={job.approvalPath} /></td>
                    <td className="px-4 py-3"><OwnerBadge owner={job.worker ?? j.worker} /></td>
                    <td className="px-4 py-3">
                      {job.ownerFinal === "Hermes" && (
                        <Badge variant="outline" className="gap-1 text-[11px] bg-hermes/10 text-hermes border-hermes/30 font-semibold">
                          <CornerDownLeft className="w-3 h-3" /> Return to Hermes
                        </Badge>
                      )}
                    </td>
                  </tr>
                )})}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-10 text-muted-foreground text-sm">Tidak ada job yang cocok dengan filter</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={() => setSelectedJob(null)}>
          <div className="w-full max-w-lg bg-card border-l border-border shadow-2xl h-full overflow-y-auto slide-in-right" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-card/80 backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between">
              <h3 className="font-semibold">Detail Handoff Job</h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedJob(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-3 flex-wrap">
                <OwnerBadge owner={detail.worker} />
                <StatusBadge status={detail.status} />
                <RiskBadge level={detail.riskLevel} />
                <ApprovalPathBadge path={detail.approvalPath} />
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Instruksi</p>
                  <p className="text-sm">{detail.contextPack.instruction}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Data Source</p>
                    <p className="text-sm font-mono">{detail.contextPack.dataSource}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Jadwal</p>
                    <p className="text-sm font-mono">{detail.contextPack.schedule}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Return Path</p>
                  <p className="text-sm">{detail.returnPath}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Terkait Task</p>
                  <p className="text-sm font-mono">{detail.taskId}</p>
                </div>
                {detail.returnOutput && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Output</p>
                    <div className="bg-muted rounded-lg p-3 text-sm font-mono">
                      {detail.returnOutput}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

