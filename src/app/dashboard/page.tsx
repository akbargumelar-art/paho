"use client"

import { useState, useEffect } from "react"
import { useAppStore } from "@/lib/store"
import type { Domain, RiskLevel, JobType, ApprovalPath, RepeatInterval, DashboardMetrics } from "@/lib/mock-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { OwnerBadge } from "@/components/shared/owner-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  Activity, Bot, Cpu, ShieldAlert, ScrollText, HeartPulse,
  AlertTriangle, Clock, ArrowRight, Zap, Plus, X,
  ListTodo, Bell, Timer
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { getGuardrailForAction, confirmGuardedAction } from "@/lib/guardrails"
import { GuardrailWarning } from "@/components/shared/guardrail-warning"

const metricCards = [
  { key: "systemStatus", label: "Status Sistem", icon: Activity, href: "/dashboard", getValue: (m: DashboardMetrics) => m.systemStatus === "online" ? "Online" : m.systemStatus === "degraded" ? "Degraded" : "Offline", color: "text-green-500" },
  { key: "activeHermesTasks", label: "Tugas Aktif Hermes", icon: Bot, href: "/dashboard/tasks", getValue: (m: DashboardMetrics) => m.activeHermesTasks.toString(), color: "text-hermes" },
  { key: "activeOpenClawJobs", label: "Jobs Aktif OpenClaw", icon: Cpu, href: "/dashboard/jobs", getValue: (m: DashboardMetrics) => m.activeOpenClawJobs.toString(), color: "text-openclaw" },
  { key: "pendingApprovals", label: "Approval Tertunda", icon: ShieldAlert, href: "/dashboard/approvals", getValue: (m: DashboardMetrics) => m.pendingApprovals.toString(), color: "text-amber-500" },
  { key: "recentLogsCount", label: "Log Terbaru", icon: ScrollText, href: "/dashboard/logs", getValue: (m: DashboardMetrics) => m.recentLogsCount.toString(), color: "text-blue-400" },
  { key: "systemHealth", label: "Kesehatan Sistem", icon: HeartPulse, href: "/dashboard/pilot", getValue: (m: DashboardMetrics) => `${m.systemHealth}%`, color: "text-emerald-500" },
]

type ModalType = "task" | "reminder" | "cron" | null

export default function DashboardPage() {
  const { logs, approvals, tasks, reminders, reminderHistory, jobs, addTask, addReminder, addJob, metrics } = useAppStore()
  const recentLogs = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10)
  const highRiskPending = approvals.filter(a => (a.riskLevel === "high" || a.riskLevel === "critical") && a.reviewStatus === "pending")
  const [targetToday, setTargetToday] = useState(0)
  const [pipelineWorkers, setPipelineWorkers] = useState<{worker:string;running:number;queued:number}[]>([])
  const [recentOutputs, setRecentOutputs] = useState<{id:string;name:string;jobName?:string;createdAt:string,size?:number}[]>([])
  useEffect(() => {
    const poll = setInterval(async () => { try { const r = await fetch("/api/dashboard/summary",{cache:"no-store"}); if(!r.ok)return; const d = await r.json(); if(d.targets){setTargetToday(d.targets.todayDone||0);setPipelineWorkers(d.pipeline?.workers||[]);setRecentOutputs(d.outputs?.items||[])} } catch {} },30_000);
    void fetch("/api/dashboard/summary").then(r=>{if(!r.ok)return;r.json().then(d=>{setTargetToday(d.targets?.todayDone||0);setPipelineWorkers(d.pipeline?.workers||[]);setRecentOutputs(d.outputs?.items||[])});}).catch(()=>{});
    return () => clearInterval(poll);
  },[]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live metrics from store (computed from DB)
  const liveMetrics: DashboardMetrics = metrics || {
    systemStatus: "online",
    activeHermesTasks: tasks.filter(t => t.status !== "completed").length,
    activeOpenClawJobs: jobs.filter(j => j.status === "running" || j.status === "queued").length,
    pendingApprovals: approvals.filter(a => a.reviewStatus === "pending").length,
    recentLogsCount: logs.length,
    systemHealth: 94,
    highRiskPending: approvals.filter(a => (a.riskLevel === "high" || a.riskLevel === "critical") && a.reviewStatus === "pending").length,
  }

  // Modal state
  const [modal, setModal] = useState<ModalType>(null)
  const [formTitle, setFormTitle] = useState("")
  const [formDetails, setFormDetails] = useState("")
  const [formDomain, setFormDomain] = useState<Domain>("work")
  const [formRisk, setFormRisk] = useState<RiskLevel>("low")
  const [formDueDate, setFormDueDate] = useState("")
  const [formSchedule, setFormSchedule] = useState("")
  const [formDataSource, setFormDataSource] = useState("")
  const [formJobType, setFormJobType] = useState<JobType>("cron")
  const [formApprovalPath, setFormApprovalPath] = useState<ApprovalPath>("Telegram-safe")
  const [formTriggerTime, setFormTriggerTime] = useState("")
  const [formRepeat, setFormRepeat] = useState<RepeatInterval>("none")
  const [formRuntimeMode, setFormRuntimeMode] = useState<"plan_only" | "hermes_cron">("plan_only")
  const cronGuardrail = getGuardrailForAction("create-cron-job", { riskLevel: formRisk })

  const resetForm = () => {
    setFormTitle("")
    setFormDetails("")
    setFormDomain("work")
    setFormRisk("low")
    setFormDueDate("")
    setFormSchedule("")
    setFormDataSource("")
    setFormJobType("cron")
    setFormApprovalPath("Telegram-safe")
    setFormTriggerTime("")
    setFormRepeat("none")
    setFormRuntimeMode("plan_only")
  }

  const openModal = (type: ModalType) => {
    resetForm()
    setModal(type)
  }

  const handleSubmit = () => {
    if (!formTitle.trim()) return

    if (modal === "task") {
      addTask({
        id: `t-${Date.now()}`,
        title: formTitle,
        details: formDetails,
        status: "pending",
        owner: "HERMES",
        domain: formDomain,
        groupId: null,
        riskLevel: formRisk,
        dueDate: formDueDate || new Date().toISOString().split("T")[0],
        createdAt: new Date().toISOString().split("T")[0],
      })
    } else if (modal === "reminder") {
      addReminder({
        id: `r-${Date.now()}`,
        taskId: null,
        title: formTitle,
        triggerTime: formTriggerTime || new Date().toISOString(),
        isActive: true,
        owner: "HERMES",
        domain: formDomain,
        status: "active",
        repeat: formRepeat,
        runtimeMode: formRuntimeMode,
        runtimeJobId: null,
      })
    } else if (modal === "cron") {
      const guard = confirmGuardedAction("create-cron-job", { riskLevel: formRisk })
      if (!guard.ok) return
      addJob({
        id: `j-${Date.now()}`,
        taskId: `t-auto-${Date.now()}`,
        contextPack: {
          instruction: formTitle,
          dataSource: formDataSource || "Manual",
          schedule: formSchedule || "0 * * * *",
        },
        worker: "OPENCLAW",
        jobType: formJobType,
        status: "queued",
        returnOutput: null,
        domain: formDomain,
        ownerFinal: "Hermes",
        returnPath: "Dashboard",
        approvalPath: formApprovalPath,
        riskLevel: formRisk,
      })
    }

    setModal(null)
  }

  const logLevelColors: Record<string, string> = {
    INFO: "border-l-log-info bg-log-info/5",
    WARN: "border-l-log-warn bg-log-warn/5",
    ERROR: "border-l-log-error bg-log-error/5",
    CRITICAL: "border-l-log-critical bg-log-critical/5",
  }

  return (
    <div className="space-y-6 fade-in-up">
      {/* Page Heading + Quick Add Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Dashboard Overview</h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-1">Pantau status ekosistem Hermes & OpenClaw secara real-time</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => openModal("task")} className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" />
            <ListTodo className="w-3.5 h-3.5" />
            Tugas
          </Button>
          <Button size="sm" variant="outline" onClick={() => openModal("reminder")} className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" />
            <Bell className="w-3.5 h-3.5" />
            Pengingat
          </Button>
          <Button size="sm" variant="outline" onClick={() => openModal("cron")} className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" />
            <Timer className="w-3.5 h-3.5" />
            Cron Job
          </Button>
        </div>
      </div>

      {/* High Risk Warning */}
      {highRiskPending.length > 0 && (
        <Link href="/dashboard/approvals" className="block">
          <Card className="border-destructive/50 bg-destructive/5 shadow-destructive/10 hover:shadow-lg hover:border-destructive/70 transition-all cursor-pointer group">
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 py-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-destructive/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-destructive glow-pulse" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-destructive text-sm sm:text-base">Peringatan: Aksi Berisiko Tinggi Tertunda</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Terdapat <span className="font-bold text-destructive">{highRiskPending.length}</span> item approval dengan risiko tinggi/kritis yang menunggu review.
                </p>
              </div>
              <span className="flex items-center gap-1 text-sm text-destructive font-medium shrink-0 group-hover:translate-x-1 transition-transform">
                Tinjau <ArrowRight className="w-4 h-4" />
              </span>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {metricCards.map((card, i) => {
          const Icon = card.icon
          return (
            <Link key={card.key} href={card.href} className="block group">
              <Card className="hover:shadow-lg hover:border-primary/30 transition-all duration-200 h-full cursor-pointer group-hover:-translate-y-0.5" style={{ animationDelay: `${i * 50}ms` }}>
                <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 py-4 sm:py-5">
                  <div className={cn("w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", card.color === "text-hermes" ? "bg-hermes/10" : card.color === "text-openclaw" ? "bg-openclaw/10" : "bg-primary/10")}>
                    <Icon className={cn("w-5 h-5 sm:w-6 sm:h-6", card.color)} />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">{card.label}</p>
                    <p className={cn("text-xl sm:text-2xl font-bold tracking-tight", card.color)}>{card.getValue(liveMetrics)}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Roundtable MVP: Target Harian, Pipeline Worker, Output Terbaru */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="py-3"><CardTitle className="flex items-center gap-2 text-sm"><Zap className="h-4 w-4 text-primary" /> Hasil Roundtable (Dashboard Paho)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><p className="text-xs text-muted-foreground">Target Harian</p><p className="text-lg font-semibold mt-1">{targetToday >= 3 ? "✅ Min. 3 sudah tercapai" : `🔵 ${targetToday} selesai hari ini (min. 3)`}</p><p className="text-[10px] text-muted-foreground mt-1">{pipelineWorkers.reduce((s,w)=>s+w.running,0)} job sedang berjalan</p></div>
          <div><p className="text-xs text-muted-foreground">Pipeline Worker</p><div className="mt-1 flex flex-wrap gap-1"> {pipelineWorkers.map(w=><span key={w.worker} className="rounded border px-2 py-1 text-[10px]">{w.worker}: 🔴{w.running} 🟡{w.queued}</span>)}</div></div>
          <div><p className="text-xs text-muted-foreground">Output Terbaru</p><ul className="mt-1 text-[11px] space-y-0.5"> {recentOutputs.slice(0,5).map(o=><li key={o.id} className="truncate">{o.jobName || o.name}</li>)}</ul><Link href="/dashboard/outputs" className="mt-2 inline-flex text-[10px] text-primary hover:underline">Buka Output Center</Link></div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Reminder Aktif</p>
            <p className="text-2xl font-bold text-hermes mt-1">{reminders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Reminder History</p>
            <p className="text-2xl font-bold text-openclaw mt-1">{reminderHistory.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Task + Reminder</p>
            <p className="text-2xl font-bold mt-1">{tasks.length + reminders.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section: Recent Logs + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Logs */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-primary" />
                Log Terbaru
              </CardTitle>
              <Link href="/dashboard/logs" className="text-sm text-primary hover:underline flex items-center gap-1">
                Lihat Semua <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentLogs.map(log => (
                <div key={log.id} className={cn("border-l-4 rounded-r-lg px-4 py-3 flex items-start gap-3 transition-colors", logLevelColors[log.level])}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] font-mono">{log.level}</Badge>
                      <OwnerBadge owner={log.owner} />
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(log.timestamp).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm mt-1 truncate">{log.message}</p>
                  </div>
                  <StatusBadge status={log.status} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Aksi Cepat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { href: "/dashboard/tasks", label: "Kelola Tugas", icon: Bot, desc: "Hermes Task Manager" },
                { href: "/dashboard/reminders", label: "Reminder Center", icon: Bell, desc: `${reminders.length} aktif / ${reminderHistory.length} history` },
                { href: "/dashboard/jobs", label: "Monitor Jobs", icon: Cpu, desc: "OpenClaw Worker Status" },
                { href: "/dashboard/approvals", label: "Review Approvals", icon: ShieldAlert, desc: `${liveMetrics.pendingApprovals} menunggu` },
                { href: "/dashboard/pilot", label: "Evaluasi Pilot", icon: Activity, desc: "Checklist progress" },
              ].map(action => (
                <Link key={action.href} href={action.href} className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors group">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 transition-transform group-hover:scale-110">
                    <action.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* System Agents Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Status Agen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-hermes glow-pulse" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Hermes</p>
                  <p className="text-xs text-muted-foreground">Front Desk - Aktif</p>
                </div>
                <Badge variant="outline" className="text-[10px] bg-hermes/10 text-hermes border-hermes/30">ONLINE</Badge>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-openclaw glow-pulse" style={{ animationDelay: "0.5s" }} />
                <div className="flex-1">
                  <p className="text-sm font-medium">OpenClaw</p>
                  <p className="text-xs text-muted-foreground">Backend Worker - Aktif</p>
                </div>
                <Badge variant="outline" className="text-[10px] bg-openclaw/10 text-openclaw border-openclaw/30">ONLINE</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ====== ADD MODALS ====== */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setModal(null)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 slide-in-right max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  modal === "task" ? "bg-hermes/10" : modal === "reminder" ? "bg-amber-500/10" : "bg-openclaw/10"
                )}>
                  {modal === "task" ? <ListTodo className="w-5 h-5 text-hermes" /> :
                   modal === "reminder" ? <Bell className="w-5 h-5 text-amber-500" /> :
                   <Timer className="w-5 h-5 text-openclaw" />}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    {modal === "task" ? "Tambah Tugas Baru" : modal === "reminder" ? "Tambah Pengingat Baru" : "Tambah Cron Job Baru"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {modal === "task" ? "Dikelola oleh Hermes" : modal === "reminder" ? "Dikelola oleh Hermes" : "Dijalankan oleh OpenClaw"}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setModal(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* Domain selector */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Kategori</Label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: "personal" as Domain, label: "Personal", short: "PR", color: "border-violet-500 bg-violet-500/10 text-violet-500" },
                    { value: "business" as Domain, label: "Bisnis", short: "BS", color: "border-emerald-500 bg-emerald-500/10 text-emerald-500" },
                    { value: "work" as Domain, label: "Kerja", short: "WK", color: "border-sky-500 bg-sky-500/10 text-sky-500" },
                  ]).map(d => (
                    <button
                      key={d.value}
                      onClick={() => setFormDomain(d.value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all font-medium text-sm",
                        formDomain === d.value
                          ? d.color + " shadow-sm scale-[1.02]"
                          : "border-border text-muted-foreground hover:border-muted-foreground/30"
                      )}
                    >
                      <span className="text-xs font-mono tracking-[0.2em]">{d.short}</span>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  {modal === "task" ? "Judul Tugas" : modal === "reminder" ? "Judul Pengingat" : "Instruksi Job"}
                </Label>
                <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder={
                  modal === "task" ? "Contoh: Review kontrak freelance..." :
                  modal === "reminder" ? "Contoh: Bayar tagihan hosting..." :
                  "Contoh: Polling harga crypto harian..."
                } className="mt-1.5" />
              </div>

              {/* Detail / Description */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  {modal === "cron" ? "Data Source" : "Detail"}
                </Label>
                {modal === "cron" ? (
                  <Input value={formDataSource} onChange={e => setFormDataSource(e.target.value)} placeholder="Contoh: CoinGecko API" className="mt-1.5" />
                ) : (
                  <Textarea value={formDetails} onChange={e => setFormDetails(e.target.value)} placeholder="Deskripsi detail..." className="mt-1.5" rows={2} />
                )}
              </div>

              {/* Specific fields per modal type */}
              {modal === "task" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tingkat Risiko</Label>
                    <select value={formRisk} onChange={e => setFormRisk(e.target.value as RiskLevel)} className="mt-1.5 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                      <option value="low">Rendah</option>
                      <option value="medium">Sedang</option>
                      <option value="high">Tinggi</option>
                      <option value="critical">Kritis</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tenggat Waktu</Label>
                    <Input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} className="mt-1.5" />
                  </div>
                </div>
              )}

              {modal === "reminder" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Waktu Pengingat</Label>
                    <Input type="datetime-local" value={formTriggerTime} onChange={e => setFormTriggerTime(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Perulangan</Label>
                    <select value={formRepeat} onChange={e => setFormRepeat(e.target.value as RepeatInterval)} className="mt-1.5 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                      <option value="none">Tidak Berulang</option>
                      <option value="daily">Harian</option>
                      <option value="weekly">Mingguan</option>
                      <option value="monthly">Bulanan</option>
                      <option value="yearly">Tahunan</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Mode Runtime</Label>
                    <select value={formRuntimeMode} onChange={e => setFormRuntimeMode(e.target.value as "plan_only" | "hermes_cron")} className="mt-1.5 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                      <option value="plan_only">Plan-only (simpan di store)</option>
                      <option value="hermes_cron">Runtime-bound (buat job Hermes cron)</option>
                    </select>
                  </div>
                </div>
              )}

              {modal === "cron" && (
                <>
                <GuardrailWarning level={cronGuardrail.level} message={cronGuardrail.message} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tipe Job</Label>
                    <select value={formJobType} onChange={e => setFormJobType(e.target.value as JobType)} className="mt-1.5 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                      <option value="cron">Cron (Terjadwal)</option>
                      <option value="polling">Polling (Berkala)</option>
                      <option value="subagent_task">Subagent Task</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Jadwal (Cron)</Label>
                    <Input value={formSchedule} onChange={e => setFormSchedule(e.target.value)} placeholder="0 9 * * 1" className="mt-1.5 font-mono" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tingkat Risiko</Label>
                    <select value={formRisk} onChange={e => setFormRisk(e.target.value as RiskLevel)} className="mt-1.5 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                      <option value="low">Rendah</option>
                      <option value="medium">Sedang</option>
                      <option value="high">Tinggi</option>
                      <option value="critical">Kritis</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Jalur Approval</Label>
                    <select value={formApprovalPath} onChange={e => setFormApprovalPath(e.target.value as ApprovalPath)} className="mt-1.5 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                      <option value="Telegram-safe">Telegram-safe</option>
                      <option value="Telegram-safe-with-review">Telegram + Review</option>
                      <option value="SSH-only">SSH-only</option>
                      <option value="OpenClaw-backend-only">Backend-only</option>
                    </select>
                  </div>
                </div>
                </>
              )}
            </div>

            {/* Submit */}
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setModal(null)} className="flex-1">Batal</Button>
              <Button onClick={handleSubmit} disabled={!formTitle.trim()} className={cn("flex-1 gap-2",
                modal === "task" ? "bg-hermes hover:bg-hermes/90" :
                modal === "cron" ? "bg-openclaw hover:bg-openclaw/90" : ""
              )}>
                <Plus className="w-4 h-4" />
                {modal === "task" ? "Tambah Tugas" : modal === "reminder" ? "Tambah Pengingat" : "Tambah Cron Job"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

