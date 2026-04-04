"use client"

import { useState } from "react"
import { useAppStore } from "@/lib/store"
import type { LogLevel, Domain } from "@/lib/mock-data"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { OwnerBadge } from "@/components/shared/owner-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { DomainBadge } from "@/components/shared/domain-badge"
import { ApprovalPathBadge } from "@/components/shared/approval-path-badge"
import { ScrollText, X, Filter, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

export default function LogsPage() {
  const logs = useAppStore(s => s.logs)
  const [selectedLog, setSelectedLog] = useState<string | null>(null)
  const [filterOwner, setFilterOwner] = useState<"all" | "Hermes" | "OpenClaw">("all")
  const [filterDomain, setFilterDomain] = useState<Domain | "all">("all")
  const [filterLevel, setFilterLevel] = useState<LogLevel | "all">("all")
  const [filterStatus, setFilterStatus] = useState<"all" | "success" | "failed" | "pending">("all")

  const filtered = [...logs]
    .filter(l => filterOwner === "all" || l.owner === filterOwner)
    .filter(l => filterDomain === "all" || l.domain === filterDomain)
    .filter(l => filterLevel === "all" || l.level === filterLevel)
    .filter(l => filterStatus === "all" || l.status === filterStatus)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const detail = selectedLog ? logs.find(l => l.id === selectedLog) : null

  const logLevelColors: Record<string, string> = {
    INFO: "border-l-log-info bg-log-info/5",
    WARN: "border-l-log-warn bg-log-warn/5",
    ERROR: "border-l-log-error bg-log-error/5",
    CRITICAL: "border-l-log-critical bg-log-critical/5",
  }

  const levelBadgeColors: Record<string, string> = {
    INFO: "bg-blue-500/15 text-blue-500 border-blue-500/30",
    WARN: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
    ERROR: "bg-red-500/15 text-red-500 border-red-500/30",
    CRITICAL: "bg-red-700/15 text-red-700 dark:text-red-400 border-red-700/30",
  }

  return (
    <div className="space-y-6 fade-in-up">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Log Eksekusi</h1>
        <p className="text-muted-foreground text-xs md:text-sm mt-1">Catatan aktivitas Hermes (Front Desk) dan OpenClaw (Backend Worker)</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <div className="flex gap-1">
              {(["all", "Hermes", "OpenClaw"] as const).map(o => (
                <button key={o} onClick={() => setFilterOwner(o)} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors", filterOwner === o ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                  {o === "all" ? "Semua Owner" : o}
                </button>
              ))}
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="flex gap-1">
              {(["all", "personal", "business", "work"] as const).map(d => (
                <button key={d} onClick={() => setFilterDomain(d)} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors", filterDomain === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                  {d === "all" ? "Semua Domain" : d === "personal" ? "Personal" : d === "business" ? "Bisnis" : "Kerja"}
                </button>
              ))}
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="flex gap-1">
              {(["all", "INFO", "WARN", "ERROR", "CRITICAL"] as const).map(l => (
                <button key={l} onClick={() => setFilterLevel(l)} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors", filterLevel === l ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                  {l === "all" ? "Semua Level" : l}
                </button>
              ))}
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="flex gap-1">
              {(["all", "success", "failed", "pending"] as const).map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors", filterStatus === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                  {s === "all" ? "Semua Status" : s === "success" ? "Sukses" : s === "failed" ? "Gagal" : "Pending"}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Entries */}
      <Card>
        <CardContent className="p-4 space-y-2">
          {filtered.map(log => (
            <div
              key={log.id}
              onClick={() => setSelectedLog(log.id)}
              className={cn(
                "border-l-4 rounded-r-lg px-4 py-3 cursor-pointer hover:shadow-md transition-all",
                logLevelColors[log.level]
              )}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={cn("text-[10px] font-mono font-bold", levelBadgeColors[log.level])}>
                  {log.level}
                </Badge>
                <OwnerBadge owner={log.owner} />
                <DomainBadge domain={log.domain} />
                {log.approvalPath && <ApprovalPathBadge path={log.approvalPath} />}
                <StatusBadge status={log.status} />
                <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                  <Clock className="w-3 h-3" />
                  {new Date(log.timestamp).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-sm mt-2">{log.message}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>Source: {log.source}</span>
                {log.jobId && <span>| Job: {log.jobId}</span>}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">Tidak ada log yang cocok dengan filter</div>
          )}
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={() => setSelectedLog(null)}>
          <div className="w-full max-w-lg bg-card border-l border-border shadow-2xl h-full overflow-y-auto slide-in-right" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-card/80 backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-primary" />
                Detail Log
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedLog(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={cn("font-mono font-bold", levelBadgeColors[detail.level])}>{detail.level}</Badge>
                <OwnerBadge owner={detail.owner} />
                <DomainBadge domain={detail.domain} />
                <StatusBadge status={detail.status} />
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Pesan</p>
                <p className="text-sm">{detail.message}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Source</p>
                  <p className="text-sm">{detail.source}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Owner</p>
                  <p className="text-sm">{detail.owner}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Domain</p>
                  <p className="text-sm capitalize">{detail.domain}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Timestamp</p>
                  <p className="text-sm">{new Date(detail.timestamp).toLocaleString("id-ID")}</p>
                </div>
              </div>

              {detail.approvalPath && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Jalur Approval</p>
                  <ApprovalPathBadge path={detail.approvalPath} />
                </div>
              )}

              {detail.jobId && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Terkait Job</p>
                  <p className="text-sm font-mono">{detail.jobId}</p>
                </div>
              )}

              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Metadata</p>
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  {Object.entries(detail.metadata).map(([k, v]) => (
                    <div key={k} className="flex items-start gap-2">
                      <span className="text-xs font-mono text-muted-foreground min-w-[80px]">{k}:</span>
                      <span className="text-sm font-mono">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

