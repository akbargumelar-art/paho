"use client"

import { useAppStore } from "@/lib/store"
import type { ApprovalPath } from "@/lib/mock-data"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RiskBadge } from "@/components/shared/risk-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  MessageCircle, Terminal, Cpu,
  Check, X, Lock, AlertTriangle, Shield
} from "lucide-react"
import { cn } from "@/lib/utils"

const sectionConfig: { path: ApprovalPath; icon: typeof MessageCircle; color: string; description: string }[] = [
  { path: "Telegram-safe", icon: MessageCircle, color: "text-green-500", description: "Approval aman melalui Telegram Push. Untuk task standar dengan risiko rendah." },
  { path: "Telegram-safe-with-review", icon: Shield, color: "text-amber-500", description: "Approval via Telegram setelah review manual. Untuk task yang melibatkan data sensitif." },
  { path: "SSH-only", icon: Terminal, color: "text-red-500", description: "HANYA dapat disetujui melalui SSH manual. Untuk perubahan konfigurasi sistem inti." },
  { path: "OpenClaw-backend-only", icon: Cpu, color: "text-slate-500", description: "Diproses otomatis oleh OpenClaw. Tidak memerlukan approval manual." },
]

export default function ApprovalsPage() {
  const { approvals, approveGuardrail, rejectGuardrail } = useAppStore()

  return (
    <div className="space-y-6 fade-in-up">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Approval & Guardrails</h1>
        <p className="text-muted-foreground text-xs md:text-sm mt-1">Pusat review dan persetujuan berdasarkan jalur SOP</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {sectionConfig.map(sec => {
          const count = approvals.filter(a => a.approvalChannel === sec.path).length
          const pending = approvals.filter(a => a.approvalChannel === sec.path && a.reviewStatus === "pending").length
          const Icon = sec.icon
          return (
            <Card key={sec.path} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4 flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", sec.color === "text-green-500" ? "bg-green-500/10" : sec.color === "text-amber-500" ? "bg-amber-500/10" : sec.color === "text-red-500" ? "bg-red-500/10" : "bg-slate-500/10")}>
                  <Icon className={cn("w-5 h-5", sec.color)} />
                </div>
                <div>
                  <p className="text-xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{pending > 0 ? `${pending} tertunda` : "Semua selesai"}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Approval Sections */}
      {sectionConfig.map(sec => {
        const items = approvals.filter(a => a.approvalChannel === sec.path)
        if (items.length === 0) return null
        const Icon = sec.icon

        return (
          <div key={sec.path} className="space-y-3">
            <div className="flex items-center gap-3">
              <Icon className={cn("w-5 h-5", sec.color)} />
              <div>
                <h2 className="font-semibold">{sec.path}</h2>
                <p className="text-xs text-muted-foreground">{sec.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map(item => (
                <Card key={item.id} className={cn(
                  "transition-all hover:shadow-md",
                  (item.riskLevel === "high" || item.riskLevel === "critical") && "border-destructive/40",
                  item.reviewStatus === "approved" && "opacity-70",
                  item.reviewStatus === "rejected" && "opacity-50"
                )}>
                  <CardContent className="py-4 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <RiskBadge level={item.riskLevel} />
                        <StatusBadge status={item.reviewStatus} />
                        {(item.riskLevel === "high" || item.riskLevel === "critical") && (
                          <div className="flex items-center gap-1 text-destructive">
                            <AlertTriangle className="w-4 h-4 glow-pulse" />
                            <span className="text-xs font-semibold">AKSI BERISIKO TINGGI</span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">{item.id}</span>
                    </div>

                    {/* Payload */}
                    <p className="text-sm">{item.requestPayload}</p>

                    {/* Meta */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Job: <span className="font-mono">{item.jobId}</span></span>
                      {item.reviewedBy && <span>| Review oleh: {item.reviewedBy}</span>}
                    </div>

                    {/* Actions */}
                    {item.reviewStatus === "pending" && (
                      <div className="flex gap-2 pt-2">
                        {sec.path === "SSH-only" ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-lg px-4 py-2 w-full">
                            <Lock className="w-4 h-4 text-destructive" />
                            <span>Approval memerlukan akses SSH manual</span>
                          </div>
                        ) : sec.path === "OpenClaw-backend-only" ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-lg px-4 py-2 w-full">
                            <Cpu className="w-4 h-4 text-slate-500" />
                            <span>Diproses otomatis tanpa approval manual dari dashboard</span>
                          </div>
                        ) : (
                          <>
                            <Button size="sm" className="flex-1 gap-1" onClick={() => approveGuardrail(item.id)}>
                              <Check className="w-3.5 h-3.5" /> Setujui
                            </Button>
                            <Button size="sm" variant="destructive" className="flex-1 gap-1" onClick={() => rejectGuardrail(item.id)}>
                              <X className="w-3.5 h-3.5" /> Tolak
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

