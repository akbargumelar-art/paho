"use client"

import { useEffect, useState } from "react"
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
import { X, Filter, CornerDownLeft, GitBranch, ActivitySquare, Pause, Play, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { confirmGuardedAction } from "@/lib/guardrails"
import { ActionToast, type ActionToastState } from "@/components/shared/action-toast"

type JobView = {
  id: string
  sourceType?: string
  source?: string
  taskId?: string | null
  contextPack: { instruction: string; dataSource: string; schedule: string }
  worker?: string
  jobType?: string
  status: string
  returnOutput?: string | null
  domain: string
  ownerFinal?: string
  returnPath?: string
  approvalPath: ApprovalPath | string
  riskLevel: string
  cronName?: string
  cronSchedule?: string
  nextRun?: string | null
  lastRun?: string | null
}

function SourceBadge({ sourceType }: { sourceType?: string }) {
  const runtime = sourceType === "runtime_openclaw_cron"
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 text-[11px] font-semibold",
        runtime
          ? "bg-openclaw/10 text-openclaw border-openclaw/30"
          : "bg-hermes/10 text-hermes border-hermes/30"
      )}
    >
      {runtime ? <ActivitySquare className="w-3 h-3" /> : <GitBranch className="w-3 h-3" />}
      {runtime ? "Runtime Job" : "Orchestration Metadata"}
    </Badge>
  )
}

function JobsTable({ jobs, onSelect, onDelete, onRuntimeAction, busyJobId }: {
  jobs: JobView[];
  onSelect: (id: string) => void;
  onDelete: (job: JobView) => void;
  onRuntimeAction: (job: JobView, action: "pause" | "resume" | "remove") => void;
  busyJobId: string | null;
}) {
  if (jobs.length === 0) {
    return <div className="text-center py-10 text-muted-foreground text-sm">Tidak ada job pada section ini.</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Job</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Domain</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Risk</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Approval</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Owner</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Return</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const instruction = job.contextPack?.instruction ?? job.cronName ?? job.id
            const isRuntime = job.sourceType === "runtime_openclaw_cron"
            const isBusy = busyJobId === job.id
            return (
              <tr
                key={job.id}
                onClick={() => onSelect(job.id)}
                className={cn(
                  "border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer",
                  (job.riskLevel === "high" || job.riskLevel === "critical") && "border-l-2 border-l-destructive",
                )}
              >
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{instruction}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs text-muted-foreground font-mono">{job.id}</p>
                      <SourceBadge sourceType={job.sourceType} />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="text-[11px] font-mono">{job.jobType ?? "cron"}</Badge>
                </td>
                <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                <td className="px-4 py-3"><DomainBadge domain={job.domain as never} /></td>
                <td className="px-4 py-3"><RiskBadge level={job.riskLevel as never} /></td>
                <td className="px-4 py-3"><ApprovalPathBadge path={job.approvalPath as never} /></td>
                <td className="px-4 py-3"><OwnerBadge owner={(job.worker ?? "OPENCLAW") as never} /></td>
                <td className="px-4 py-3">
                  {job.ownerFinal === "Hermes" && (
                    <Badge variant="outline" className="gap-1 text-[11px] bg-hermes/10 text-hermes border-hermes/30 font-semibold">
                      <CornerDownLeft className="w-3 h-3" /> Return to Hermes
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {isRuntime ? (
                      <>
                        {job.status !== "disabled" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isBusy} onClick={() => onRuntimeAction(job, "pause")} title="Pause runtime job">
                            <Pause className="w-3.5 h-3.5 text-amber-500" />
                          </Button>
                        )}
                        {job.status === "disabled" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isBusy} onClick={() => onRuntimeAction(job, "resume")} title="Resume runtime job">
                            <Play className="w-3.5 h-3.5 text-green-500" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isBusy} onClick={() => onRuntimeAction(job, "remove")} title="Remove runtime job">
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isBusy} onClick={() => onDelete(job)} title="Delete orchestration metadata">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

type JobsStore = {
  jobs: JobView[]
  deleteJob: (id: string, sourceType?: string) => Promise<void>
  runtimeJobAction: (id: string, action: "pause" | "resume" | "remove", sourceType?: string) => Promise<void>
  fetchAll: () => Promise<void>
}

export default function JobsPage() {
  const { jobs, deleteJob, runtimeJobAction, fetchAll } = useAppStore() as unknown as JobsStore
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<JobStatus | "all">("all")
  const [filterPath, setFilterPath] = useState<ApprovalPath | "all">("all")
  const [busyJobId, setBusyJobId] = useState<string | null>(null)
  const [toast, setToast] = useState<ActionToastState>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  const filtered = jobs.filter((j: JobView) => {
    if (filterStatus !== "all" && j.status !== filterStatus) return false
    if (filterPath !== "all" && j.approvalPath !== filterPath) return false
    return true
  })

  const orchestrationJobs = filtered.filter((j: JobView) => j.sourceType === "orchestration_metadata")
  const runtimeJobs = filtered.filter((j: JobView) => j.sourceType === "runtime_openclaw_cron")

  const detail = selectedJob ? jobs.find((j: JobView) => j.id === selectedJob) : null

  const handleDelete = async (job: JobView) => {
    const guard = confirmGuardedAction("delete-orchestration-job")
    if (!guard.ok) return
    setBusyJobId(job.id)
    try {
      await deleteJob(job.id, job.sourceType)
      await fetchAll()
      setToast({ type: "success", message: `Job metadata ${job.id} berhasil dihapus.` })
    } catch {
      setToast({ type: "error", message: `Gagal menghapus job metadata ${job.id}.` })
    } finally {
      setBusyJobId(null)
    }
  }

  const handleRuntimeAction = async (job: JobView, action: "pause" | "resume" | "remove") => {
    const guard = confirmGuardedAction("runtime-job-action", { sourceType: job.sourceType, riskLevel: job.riskLevel })
    if (!guard.ok) return
    setBusyJobId(job.id)
    try {
      await runtimeJobAction(job.id, action, job.sourceType)
      await fetchAll()
      setToast({ type: "success", message: `Runtime job ${job.id} berhasil ${action}.` })
    } catch {
      setToast({ type: "error", message: `Gagal menjalankan action ${action} untuk ${job.id}.` })
    } finally {
      setBusyJobId(null)
    }
  }

  return (
    <div className="space-y-6 fade-in-up">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Jobs & Handoff</h1>
        <p className="text-muted-foreground text-xs md:text-sm mt-1">Panel pemantauan dibagi tegas antara orchestration metadata dan runtime jobs.</p>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <div className="flex gap-1 flex-wrap">
              {(["all", "queued", "running", "waiting_approval", "done"] as const).map((s) => (
                <button key={s} onClick={() => setFilterStatus(s)} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors", filterStatus === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                  {s === "all" ? "Semua Status" : s === "queued" ? "Antrian" : s === "running" ? "Berjalan" : s === "waiting_approval" ? "Menunggu Approval" : "Selesai"}
                </button>
              ))}
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="flex gap-1 flex-wrap">
              {(["all", "Telegram-safe", "Telegram-safe-with-review", "SSH-only", "OpenClaw-backend-only"] as const).map((p) => (
                <button key={p} onClick={() => setFilterPath(p)} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors", filterPath === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                  {p === "all" ? "Semua Jalur" : p}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-hermes" />
                <h3 className="font-semibold">Orchestration Metadata</h3>
                <Badge variant="outline" className="text-[11px]">{orchestrationJobs.length}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Job metadata yang dibuat via UI dan disimpan sebagai orchestration layer.</p>
            </div>
            <JobsTable jobs={orchestrationJobs} onSelect={setSelectedJob} onDelete={handleDelete} onRuntimeAction={handleRuntimeAction} busyJobId={busyJobId} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <ActivitySquare className="w-4 h-4 text-openclaw" />
                <h3 className="font-semibold">Runtime Jobs</h3>
                <Badge variant="outline" className="text-[11px]">{runtimeJobs.length}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Cron/runtime job nyata yang dibaca live dari OpenClaw.</p>
            </div>
            <JobsTable jobs={runtimeJobs} onSelect={setSelectedJob} onDelete={handleDelete} onRuntimeAction={handleRuntimeAction} busyJobId={busyJobId} />
          </CardContent>
        </Card>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={() => setSelectedJob(null)}>
          <div className="w-full max-w-lg bg-card border-l border-border shadow-2xl h-full overflow-y-auto slide-in-right" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-card/80 backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between">
              <h3 className="font-semibold">Job Detail</h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedJob(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-3 flex-wrap">
                <SourceBadge sourceType={detail.sourceType} />
                <OwnerBadge owner={(detail.worker ?? "OPENCLAW") as never} />
                <StatusBadge status={detail.status} />
                <RiskBadge level={detail.riskLevel as never} />
                <ApprovalPathBadge path={detail.approvalPath as never} />
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Instruksi</p>
                  <p className="text-sm">{detail.contextPack.instruction}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Data Source</p>
                    <p className="text-sm font-mono">{detail.contextPack.dataSource || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Jadwal</p>
                    <p className="text-sm font-mono">{detail.contextPack.schedule || '-'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Return Path</p>
                    <p className="text-sm">{detail.returnPath || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Task ID</p>
                    <p className="text-sm font-mono">{detail.taskId || '-'}</p>
                  </div>
                </div>
                {detail.nextRun && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Next Run</p>
                    <p className="text-sm font-mono">{detail.nextRun}</p>
                  </div>
                )}
                {detail.lastRun && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Last Run</p>
                    <p className="text-sm font-mono">{detail.lastRun}</p>
                  </div>
                )}
                {detail.returnOutput && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Output</p>
                    <div className="bg-muted rounded-lg p-3 text-sm font-mono break-words">{detail.returnOutput}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ActionToast toast={toast} />
    </div>
  )
}
