"use client"

import { useState, useMemo } from "react"
import { useAppStore } from "@/lib/store"
import type { Domain, RiskLevel, TaskGroup } from "@/lib/mock-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { OwnerBadge } from "@/components/shared/owner-badge"
import { RiskBadge } from "@/components/shared/risk-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { DomainBadge } from "@/components/shared/domain-badge"
import {
  ListTodo, Bell, Plus, X, Calendar, Filter, Copy,
  Pause, Edit, Trash2, Check,
  FolderOpen, Tag, ChevronDown, ChevronRight,
  LayoutGrid, List, Layers
} from "lucide-react"
import { cn } from "@/lib/utils"
import { confirmGuardedAction, getGuardrailForAction } from "@/lib/guardrails"
import { GuardrailWarning } from "@/components/shared/guardrail-warning"

type Tab = "tasks" | "reminders"
type ViewMode = "grouped" | "flat"

// Preset colors for group creation
const GROUP_COLORS = [
  "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#6366f1", "#ef4444", "#14b8a6",
  "#f97316", "#a855f7", "#06b6d4", "#84cc16",
]

const GROUP_ICONS = [
  "🏠", "🎨", "📈", "⚙️", "🖥️", "💼", "🛡️", "📚",
  "🎯", "💡", "🔥", "🚀", "📦", "🛒", "🎵", "🏋️",
  "🌍", "💰", "📝", "🔧", "📊", "🎮", "🏢", "✈️",
]

export default function TasksPage() {
  const {
    tasks, taskHistory, reminders, reminderHistory, taskGroups,
    addTask, updateTask, deleteTask, updateReminder,
    addTaskGroup, updateTaskGroup, deleteTaskGroup
  } = useAppStore()
  const [selectedReminder, setSelectedReminder] = useState<(typeof reminders[number] & { sourceType?: string; responsePreview?: string; outputPath?: string; jobId?: string }) | null>(null)

  const [activeTab, setActiveTab] = useState<Tab>("tasks")
  const [viewMode, setViewMode] = useState<ViewMode>("grouped")
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // Filters
  const [filterDomain, setFilterDomain] = useState<Domain | "all">("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterRisk, setFilterRisk] = useState<RiskLevel | "all">("all")
  const [filterGroup, setFilterGroup] = useState<string>("all")
  const [filterReminderSource, setFilterReminderSource] = useState<string>("all")
  const deleteTaskGuard = getGuardrailForAction("delete-task")

  // Task form state
  const [formTitle, setFormTitle] = useState("")
  const [formDetails, setFormDetails] = useState("")
  const [formDomain, setFormDomain] = useState<Domain>("work")
  const [formRisk, setFormRisk] = useState<RiskLevel>("low")
  const [formDueDate, setFormDueDate] = useState("")
  const [formGroupId, setFormGroupId] = useState<string | null>(null)

  // Group form state
  const [groupName, setGroupName] = useState("")
  const [groupDomain, setGroupDomain] = useState<Domain>("personal")
  const [groupColor, setGroupColor] = useState(GROUP_COLORS[0])
  const [groupIcon, setGroupIcon] = useState(GROUP_ICONS[0])

  // Filtered tasks
  const filteredTasks = tasks.filter(t => {
    if (filterDomain !== "all" && t.domain !== filterDomain) return false
    if (filterStatus !== "all" && t.status !== filterStatus) return false
    if (filterRisk !== "all" && t.riskLevel !== filterRisk) return false
    if (filterGroup !== "all") {
      if (filterGroup === "ungrouped") return t.groupId === null
      if (t.groupId !== filterGroup) return false
    }
    return true
  })

  // Filtered reminders
  const filteredReminders = reminders.filter(r => {
    if (filterDomain !== "all" && r.domain !== filterDomain) return false
    if (filterStatus !== "all" && r.status !== filterStatus) return false
    if (filterReminderSource !== "all" && r.sourceType !== filterReminderSource) return false
    return true
  })

  const filteredReminderHistory = reminderHistory.filter(r => {
    if (filterDomain !== "all" && r.domain !== filterDomain) return false
    if (filterStatus !== "all" && r.status !== filterStatus) return false
    if (filterReminderSource !== "all" && r.sourceType !== filterReminderSource) return false
    return true
  })

  // Build grouped structure
  const groupedTasks = useMemo(() => {
    const groups: { group: TaskGroup | null; tasks: typeof filteredTasks }[] = []

    // First add tasks from each group
    const relevantGroups = taskGroups.filter(g =>
      filterDomain === "all" || g.domain === filterDomain
    )

    for (const group of relevantGroups) {
      const groupTasks = filteredTasks.filter(t => t.groupId === group.id)
      if (groupTasks.length > 0 || filterGroup === group.id) {
        groups.push({ group, tasks: groupTasks })
      }
    }

    // Then add ungrouped tasks
    const ungrouped = filteredTasks.filter(t => t.groupId === null)
    if (ungrouped.length > 0) {
      groups.push({ group: null, tasks: ungrouped })
    }

    return groups
  }, [filteredTasks, taskGroups, filterDomain, filterGroup])

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  // Available groups for selected domain in the task form
  const availableGroups = taskGroups.filter(g => g.domain === formDomain)

  // ---- Form handlers ----
  const openCreateTask = (presetGroupId?: string) => {
    setEditingTaskId(null)
    setFormTitle("")
    setFormDetails("")
    setFormDomain("work")
    setFormRisk("low")
    setFormDueDate("")
    setFormGroupId(presetGroupId || null)
    if (presetGroupId) {
      const group = taskGroups.find(g => g.id === presetGroupId)
      if (group) setFormDomain(group.domain)
    }
    setShowTaskForm(true)
  }

  const openEditTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    setEditingTaskId(taskId)
    setFormTitle(task.title)
    setFormDetails(task.details)
    setFormDomain(task.domain)
    setFormRisk(task.riskLevel)
    setFormDueDate(task.dueDate)
    setFormGroupId(task.groupId)
    setShowTaskForm(true)
  }

  const handleSubmitTask = () => {
    if (!formTitle.trim()) return
    if (editingTaskId) {
      updateTask(editingTaskId, {
        title: formTitle,
        details: formDetails,
        domain: formDomain,
        riskLevel: formRisk,
        dueDate: formDueDate,
        groupId: formGroupId,
      })
    } else {
      addTask({
        id: `t-${Date.now()}`,
        title: formTitle,
        details: formDetails,
        status: "pending",
        owner: "HERMES",
        domain: formDomain,
        groupId: formGroupId,
        riskLevel: formRisk,
        dueDate: formDueDate,
        createdAt: new Date().toISOString().split("T")[0],
      })
    }
    setShowTaskForm(false)
  }

  const openCreateGroup = () => {
    setEditingGroupId(null)
    setGroupName("")
    setGroupDomain("personal")
    setGroupColor(GROUP_COLORS[0])
    setGroupIcon(GROUP_ICONS[0])
    setShowGroupForm(true)
  }

  const openEditGroup = (groupId: string) => {
    const group = taskGroups.find(g => g.id === groupId)
    if (!group) return
    setEditingGroupId(groupId)
    setGroupName(group.name)
    setGroupDomain(group.domain)
    setGroupColor(group.color)
    setGroupIcon(group.icon)
    setShowGroupForm(true)
  }

  const handleSubmitGroup = () => {
    if (!groupName.trim()) return
    if (editingGroupId) {
      updateTaskGroup(editingGroupId, {
        name: groupName,
        domain: groupDomain,
        color: groupColor,
        icon: groupIcon,
      })
    } else {
      addTaskGroup({
        id: `g-${Date.now()}`,
        name: groupName,
        domain: groupDomain,
        color: groupColor,
        icon: groupIcon,
        createdAt: new Date().toISOString().split("T")[0],
      })
    }
    setShowGroupForm(false)
  }

  const handleDeleteGroup = (groupId: string) => {
    const guard = confirmGuardedAction("delete-task-group")
    if (!guard.ok) return
    deleteTaskGroup(groupId)
  }

  // Count helpers
  const getGroupTaskCount = (groupId: string) => tasks.filter(t => t.groupId === groupId).length
  const getGroupCompletedCount = (groupId: string) => tasks.filter(t => t.groupId === groupId && t.status === "completed").length

  // ---- Task Row Component ----
  const TaskRow = ({ task }: { task: typeof tasks[0] }) => (
    <tr className={cn(
      "border-b border-border/50 hover:bg-muted/30 transition-colors",
      task.riskLevel === "critical" && "border-l-2 border-l-destructive"
    )}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {task.groupId && (
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: taskGroups.find(g => g.id === task.groupId)?.color || "#888" }}
            />
          )}
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{task.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.details}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
      <td className="px-4 py-3"><DomainBadge domain={task.domain} /></td>
      <td className="px-4 py-3"><RiskBadge level={task.riskLevel} /></td>
      <td className="px-4 py-3">
        <span className="text-sm flex items-center gap-1 text-muted-foreground">
          <Calendar className="w-3 h-3" />
          {new Date(task.dueDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
        </span>
      </td>
      <td className="px-4 py-3"><OwnerBadge owner={task.owner} /></td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {task.status !== "completed" && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateTask(task.id, { status: "completed" })} title="Selesaikan">
              <Check className="w-3.5 h-3.5 text-green-500" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTask(task.id)} title="Edit">
            <Edit className="w-3.5 h-3.5" />
          </Button>
          {task.status === "in-progress" && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateTask(task.id, { status: "pending" })} title="Jeda">
              <Pause className="w-3.5 h-3.5 text-amber-500" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { const guard = confirmGuardedAction("delete-task"); if (!guard.ok) return; deleteTask(task.id) }} title="Hapus">
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </div>
      </td>
    </tr>
  )

  return (
    <div className="space-y-6 fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Tugas & Pengingat</h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-1">Dikelola eksklusif oleh Hermes — Single Source of Truth</p>
        </div>
        {activeTab === "tasks" && (
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => openCreateTask()} className="gap-2" size="sm">
              <Plus className="w-4 h-4" /> Tugas
            </Button>
            <Button onClick={openCreateGroup} variant="outline" className="gap-2" size="sm">
              <FolderOpen className="w-4 h-4" /> Grup
            </Button>
          </div>
        )}
      </div>

      {/* Tabs + View Mode Toggle */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          <button onClick={() => setActiveTab("tasks")} className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all", activeTab === "tasks" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <ListTodo className="w-4 h-4" /> Tugas ({tasks.length})
          </button>
          <button onClick={() => setActiveTab("reminders")} className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all", activeTab === "reminders" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <Bell className="w-4 h-4" /> Pengingat ({reminders.length})
          </button>
        </div>

        {activeTab === "tasks" && (
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setViewMode("grouped")}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all", viewMode === "grouped" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <Layers className="w-3.5 h-3.5" /> Grouped
            </button>
            <button
              onClick={() => setViewMode("flat")}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all", viewMode === "flat" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <List className="w-3.5 h-3.5" /> Flat
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="mb-3">
            <GuardrailWarning level={deleteTaskGuard.level} message={activeTab === "tasks" ? deleteTaskGuard.message : "Reminder Center aktif hanya mengizinkan toggle untuk live-store. Runtime reminder tidak ditulis langsung dari UI ini."} />
          </div>
          <div className="flex items-center gap-3 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-hide">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex gap-1">
              {(["all", "personal", "business", "work"] as const).map(d => (
                <button key={d} onClick={() => setFilterDomain(d)} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap", filterDomain === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                  {d === "all" ? "Semua Domain" : d === "personal" ? "Personal" : d === "business" ? "Bisnis" : "Kerja"}
                </button>
              ))}
            </div>
            <div className="w-px h-6 bg-border shrink-0" />
            <div className="flex gap-1 shrink-0">
              {activeTab === "tasks" ? (
                (["all", "pending", "in-progress", "completed"] as const).map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap", filterStatus === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                    {s === "all" ? "Semua Status" : s === "pending" ? "Menunggu" : s === "in-progress" ? "Berjalan" : "Selesai"}
                  </button>
                ))
              ) : (
                (["all", "active", "completed", "archived"] as const).map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap", filterStatus === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                    {s === "all" ? "Semua Status" : s === "active" ? "Aktif" : s === "completed" ? "Selesai" : "Arsip"}
                  </button>
                ))
              )}
            </div>
            {activeTab === "reminders" && (
              <>
                <div className="w-px h-6 bg-border shrink-0" />
                <div className="flex gap-1 shrink-0">
                  {(["all", "live-store", "hermes-cron", "hermes-cron-output"] as const).map(src => (
                    <button key={src} onClick={() => setFilterReminderSource(src)} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap", filterReminderSource === src ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                      {src === "all" ? "Semua Sumber" : src}
                    </button>
                  ))}
                </div>
              </>
            )}
            {activeTab === "tasks" && (
              <>
                <div className="w-px h-6 bg-border shrink-0" />
                <div className="flex gap-1 shrink-0">
                  {(["all", "low", "medium", "high", "critical"] as const).map(r => (
                    <button key={r} onClick={() => setFilterRisk(r)} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap", filterRisk === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                      {r === "all" ? "Semua Risiko" : r === "low" ? "Rendah" : r === "medium" ? "Sedang" : r === "high" ? "Tinggi" : "Kritis"}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Group filter (only for tasks) */}
          {activeTab === "tasks" && taskGroups.length > 0 && (
            <div className="flex items-center gap-3 mt-3 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-hide">
              <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex gap-1.5">
                <button
                  onClick={() => setFilterGroup("all")}
                  className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap", filterGroup === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}
                >
                  Semua Grup
                </button>
                {taskGroups
                  .filter(g => filterDomain === "all" || g.domain === filterDomain)
                  .map(g => (
                  <button
                    key={g.id}
                    onClick={() => setFilterGroup(g.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                      filterGroup === g.id
                        ? "text-white shadow-sm"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    )}
                    style={filterGroup === g.id ? { backgroundColor: g.color } : undefined}
                  >
                    <span className="text-sm">{g.icon}</span> {g.name}
                  </button>
                ))}
                <button
                  onClick={() => setFilterGroup("ungrouped")}
                  className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap", filterGroup === "ungrouped" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}
                >
                  Tanpa Grup
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ====== TASK CONTENT ====== */}
      {activeTab === "tasks" ? (
        viewMode === "grouped" ? (
          /* ---- GROUPED VIEW ---- */
          <div className="space-y-4">
            {groupedTasks.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground text-sm">
                  Tidak ada tugas yang cocok dengan filter
                </CardContent>
              </Card>
            )}

            {groupedTasks.map(({ group, tasks: gTasks }) => {
              const groupKey = group?.id || "ungrouped"
              const isCollapsed = collapsedGroups.has(groupKey)
              const completedCount = gTasks.filter(t => t.status === "completed").length
              const totalCount = gTasks.length
              const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

              return (
                <Card key={groupKey} className="overflow-hidden">
                  {/* Group Header */}
                  <div
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 cursor-pointer select-none transition-colors hover:bg-muted/50",
                      !group && "border-l-4 border-l-muted-foreground/30"
                    )}
                    style={group ? { borderLeft: `4px solid ${group.color}` } : undefined}
                    onClick={() => toggleGroup(groupKey)}
                  >
                    <button className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {group ? (
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-lg shrink-0">{group.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{group.name}</span>
                            <DomainBadge domain={group.domain} />
                            <Badge variant="outline" className="text-[10px]">
                              {completedCount}/{totalCount}
                            </Badge>
                          </div>
                          {/* Mini progress bar */}
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[200px]">
                              <div
                                className="h-full rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${progressPct}%`, backgroundColor: group.color }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground">{progressPct}%</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-1">
                        <FolderOpen className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold text-sm text-muted-foreground">Tanpa Grup</span>
                        <Badge variant="outline" className="text-[10px]">{totalCount}</Badge>
                      </div>
                    )}

                    {/* Group Actions */}
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      {group && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openCreateTask(group.id)}
                            title="Tambah tugas ke grup ini"
                          >
                            <Plus className="w-3.5 h-3.5 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditGroup(group.id)}
                            title="Edit grup"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleDeleteGroup(group.id)}
                            title="Hapus grup"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Task Table inside group */}
                  {!isCollapsed && (
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px]">
                          <thead>
                            <tr className="border-b border-t border-border bg-muted/30">
                              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tugas</th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Domain</th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Risiko</th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tenggat</th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pemilik</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {gTasks.map(task => <TaskRow key={task.id} task={task} />)}
                            {gTasks.length === 0 && (
                              <tr>
                                <td colSpan={7} className="text-center py-6 text-muted-foreground text-xs">
                                  Tidak ada tugas dalam grup ini
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        ) : (
          /* ---- FLAT VIEW ---- */
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tugas</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Grup</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Domain</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Risiko</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tenggat</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pemilik</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map(task => {
                      const group = task.groupId ? taskGroups.find(g => g.id === task.groupId) : null
                      return (
                        <tr key={task.id} className={cn("border-b border-border/50 hover:bg-muted/30 transition-colors", task.riskLevel === "critical" && "border-l-2 border-l-destructive")}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-sm">{task.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.details}</p>
                          </td>
                          <td className="px-4 py-3">
                            {group ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-white"
                                style={{ backgroundColor: group.color }}
                              >
                                {group.icon} {group.name}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
                          <td className="px-4 py-3"><DomainBadge domain={task.domain} /></td>
                          <td className="px-4 py-3"><RiskBadge level={task.riskLevel} /></td>
                          <td className="px-4 py-3">
                            <span className="text-sm flex items-center gap-1 text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {new Date(task.dueDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                            </span>
                          </td>
                          <td className="px-4 py-3"><OwnerBadge owner={task.owner} /></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {task.status !== "completed" && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateTask(task.id, { status: "completed" })} title="Selesaikan">
                                  <Check className="w-3.5 h-3.5 text-green-500" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTask(task.id)} title="Edit">
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              {task.status === "in-progress" && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateTask(task.id, { status: "pending" })} title="Jeda">
                                  <Pause className="w-3.5 h-3.5 text-amber-500" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteTask(task.id)} title="Hapus">
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {filteredTasks.length === 0 && (
                      <tr><td colSpan={8} className="text-center py-10 text-muted-foreground text-sm">Tidak ada tugas yang cocok dengan filter</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="w-5 h-5 text-primary" />
                Pengingat Aktif & Runtime
              </CardTitle>
              <Badge variant="outline" className="text-[11px]">{filteredReminders.length}</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pengingat</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Waktu</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Perulangan</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Domain</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aktif</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pemilik</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sumber</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReminders.map(rem => {
                      const remView = rem as typeof rem & { sourceType?: string }
                      return (
                      <tr key={rem.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-sm">{rem.title}</p>
                          {rem.taskId && <p className="text-xs text-muted-foreground mt-0.5">Terkait: {rem.taskId}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-muted-foreground">
                            {rem.triggerTime ? new Date(rem.triggerTime).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground capitalize">
                            {String(rem.repeat || 'none') !== "none" && String(rem.repeat || 'none') !== "custom" ? String(rem.repeat) === "daily" ? "Harian" : String(rem.repeat) === "weekly" ? "Mingguan" : String(rem.repeat) === "monthly" ? "Bulanan" : "Tahunan" : String(rem.repeat || 'none') === "custom" ? "Cron" : "Sekali"}
                          </span>
                        </td>
                        <td className="px-4 py-3"><DomainBadge domain={rem.domain} /></td>
                        <td className="px-4 py-3"><StatusBadge status={rem.status} /></td>
                        <td className="px-4 py-3">
                          {remView.sourceType === "live-store" ? (
                            <button
                              onClick={() => updateReminder(rem.id, { isActive: !rem.isActive })}
                              className={cn("w-10 h-5 rounded-full transition-colors relative", rem.isActive ? "bg-primary" : "bg-muted")}
                            >
                              <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", rem.isActive ? "left-5" : "left-0.5")} />
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">runtime</span>
                          )}
                        </td>
                        <td className="px-4 py-3"><OwnerBadge owner={rem.owner} /></td>
                        <td className="px-4 py-3"><Badge variant="outline" className="text-[11px]">{remView.sourceType || 'live-store'}</Badge></td>
                      </tr>
                    )})}
                    {filteredReminders.length === 0 && (
                      <tr><td colSpan={8} className="text-center py-10 text-muted-foreground text-sm">Tidak ada pengingat aktif yang cocok dengan filter</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="w-5 h-5 text-muted-foreground" />
                History Pengingat
              </CardTitle>
              <Badge variant="outline" className="text-[11px]">{filteredReminderHistory.length}</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pengingat</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Waktu</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Domain</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pemilik</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sumber</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReminderHistory.map(rem => {
                      const remView = rem as typeof rem & { sourceType?: string }
                      return (
                      <tr key={rem.id} onClick={() => setSelectedReminder(remView)} className="border-b border-border/50 hover:bg-muted/20 transition-colors opacity-90 cursor-pointer">
                        <td className="px-4 py-3">
                          <p className="font-medium text-sm">{rem.title}</p>
                          {rem.taskId && <p className="text-xs text-muted-foreground mt-0.5">Terkait: {rem.taskId}</p>}
                          {rem.responsePreview && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{rem.responsePreview}</p>
                          )}
                        </td>
                        <td className="px-4 py-3"><span className="text-sm text-muted-foreground">{rem.triggerTime ? new Date(rem.triggerTime).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-"}</span></td>
                        <td className="px-4 py-3"><DomainBadge domain={rem.domain} /></td>
                        <td className="px-4 py-3"><StatusBadge status={rem.status} /></td>
                        <td className="px-4 py-3"><OwnerBadge owner={rem.owner} /></td>
                        <td className="px-4 py-3"><Badge variant="outline" className="text-[11px]">{remView.sourceType || 'live-store'}</Badge></td>
                      </tr>
                    )})}
                    {filteredReminderHistory.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">Belum ada history pengingat pada filter ini</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ====== GROUP OVERVIEW SIDEBAR (below the main content) ====== */}
      {activeTab === "tasks" && taskGroups.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutGrid className="w-5 h-5 text-primary" />
              Ringkasan Grup
            </CardTitle>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={openCreateGroup}>
              <Plus className="w-3.5 h-3.5" /> Grup Baru
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {taskGroups
                .filter(g => filterDomain === "all" || g.domain === filterDomain)
                .map(group => {
                  const total = getGroupTaskCount(group.id)
                  const completed = getGroupCompletedCount(group.id)
                  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

                  return (
                    <div
                      key={group.id}
                      className="relative group/card rounded-xl border border-border p-4 hover:shadow-md transition-all cursor-pointer hover:-translate-y-0.5"
                      style={{ borderLeftWidth: "4px", borderLeftColor: group.color }}
                      onClick={() => setFilterGroup(filterGroup === group.id ? "all" : group.id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{group.icon}</span>
                          <div>
                            <p className="text-sm font-semibold leading-tight">{group.name}</p>
                            <DomainBadge domain={group.domain} />
                          </div>
                        </div>
                        <div className="flex gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditGroup(group.id)}>
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteGroup(group.id)}>
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-3">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: group.color }}
                          />
                        </div>
                        <span className="text-[11px] text-muted-foreground font-medium">{completed}/{total}</span>
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "tasks" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTodo className="w-5 h-5 text-muted-foreground" />
              History Tugas
            </CardTitle>
            <Badge variant="outline" className="text-[11px]">{taskHistory.length}</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Task</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Domain</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Waktu</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {taskHistory.map(item => (
                    <tr key={item.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">{item.taskId}</p>
                      </td>
                      <td className="px-4 py-3"><Badge variant="outline" className="text-[11px]">{item.action}</Badge></td>
                      <td className="px-4 py-3"><Badge variant="outline" className="text-[11px]">{item.status}</Badge></td>
                      <td className="px-4 py-3"><DomainBadge domain={item.domain} /></td>
                      <td className="px-4 py-3"><span className="text-sm text-muted-foreground">{new Date(item.timestamp).toLocaleString("id-ID")}</span></td>
                      <td className="px-4 py-3"><span className="text-sm text-muted-foreground">{item.note || '-'}</span></td>
                    </tr>
                  ))}
                  {taskHistory.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">Belum ada history tugas</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "tasks" && taskHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTodo className="w-5 h-5 text-primary" />
              Timeline History Tugas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {taskHistory.slice(0, 12).map(item => (
                <div key={`timeline-${item.id}`} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-primary mt-1" />
                    <div className="w-px flex-1 bg-border mt-2" />
                  </div>
                  <div className="flex-1 rounded-xl border border-border bg-muted/20 p-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-medium text-sm">{item.title}</p>
                      <span className="text-xs text-muted-foreground">{new Date(item.timestamp).toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      <Badge variant="outline" className="text-[11px]">{item.action}</Badge>
                      <DomainBadge domain={item.domain} />
                      <Badge variant="outline" className="text-[11px]">{item.status}</Badge>
                    </div>
                    {item.note && <p className="text-xs text-muted-foreground mt-2">{item.note}</p>}
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
              <Button variant="ghost" size="icon" onClick={() => setSelectedReminder(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3 flex-wrap">
                <StatusBadge status={selectedReminder.status} />
                <DomainBadge domain={selectedReminder.domain} />
                <OwnerBadge owner={selectedReminder.owner} />
                <Badge variant="outline" className="text-[11px]">{selectedReminder.sourceType || 'live-store'}</Badge>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Judul</p>
                <p className="text-sm font-medium">{selectedReminder.title}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Waktu</p>
                  <p className="text-sm">{selectedReminder.triggerTime || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Repeat</p>
                  <p className="text-sm">{selectedReminder.repeat || 'none'}</p>
                </div>
              </div>

              {'jobId' in selectedReminder && selectedReminder.jobId && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Job ID</p>
                  <p className="text-sm font-mono break-all">{selectedReminder.jobId}</p>
                </div>
              )}

              {'outputPath' in selectedReminder && selectedReminder.outputPath && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Output Path</p>
                  <div className="flex gap-2 items-start">
                    <p className="text-sm font-mono break-all flex-1">{selectedReminder.outputPath}</p>
                    <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(String(selectedReminder.outputPath))}><Copy className="w-3 h-3 mr-1" /> Copy Path</Button>
                  </div>
                </div>
              )}

              {'responsePreview' in selectedReminder && selectedReminder.responsePreview && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Preview</p>
                  <div className="bg-muted rounded-lg p-3 text-sm whitespace-pre-wrap break-words">{String(selectedReminder.responsePreview).replaceAll(' | ', '\n')}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====== CREATE/EDIT TASK MODAL ====== */}
      {showTaskForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowTaskForm(false)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 slide-in-right max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">{editingTaskId ? "Edit Tugas" : "Tambah Tugas Baru"}</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowTaskForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Judul</Label>
                <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Judul tugas..." className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Detail</Label>
                <Textarea value={formDetails} onChange={e => setFormDetails(e.target.value)} placeholder="Deskripsi tugas..." className="mt-1.5" rows={3} />
              </div>

              {/* Domain selector */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Domain</Label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: "personal" as Domain, label: "Personal", emoji: "👤", color: "border-violet-500 bg-violet-500/10 text-violet-500" },
                    { value: "business" as Domain, label: "Bisnis", emoji: "💼", color: "border-emerald-500 bg-emerald-500/10 text-emerald-500" },
                    { value: "work" as Domain, label: "Kerja", emoji: "🔧", color: "border-sky-500 bg-sky-500/10 text-sky-500" },
                  ]).map(d => (
                    <button
                      key={d.value}
                      onClick={() => {
                        setFormDomain(d.value)
                        // Reset group if domain changes and current group doesn't match
                        if (formGroupId) {
                          const currentGroup = taskGroups.find(g => g.id === formGroupId)
                          if (currentGroup && currentGroup.domain !== d.value) {
                            setFormGroupId(null)
                          }
                        }
                      }}
                      className={cn(
                        "flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition-all font-medium text-xs",
                        formDomain === d.value
                          ? d.color + " shadow-sm scale-[1.02]"
                          : "border-border text-muted-foreground hover:border-muted-foreground/30"
                      )}
                    >
                      <span className="text-lg">{d.emoji}</span>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Group selector */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                  Grup <span className="normal-case font-normal">(opsional)</span>
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setFormGroupId(null)}
                    className={cn(
                      "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                      formGroupId === null
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-muted-foreground/50"
                    )}
                  >
                    Tanpa Grup
                  </button>
                  {availableGroups.map(g => (
                    <button
                      key={g.id}
                      onClick={() => setFormGroupId(g.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                        formGroupId === g.id
                          ? "text-white border-transparent shadow-sm"
                          : "border-border text-muted-foreground hover:border-muted-foreground/50"
                      )}
                      style={formGroupId === g.id ? { backgroundColor: g.color } : undefined}
                    >
                      <span className="text-sm">{g.icon}</span> {g.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Risiko</Label>
                  <select value={formRisk} onChange={e => setFormRisk(e.target.value as RiskLevel)} className="mt-1.5 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                    <option value="low">🟢 Rendah</option>
                    <option value="medium">🟡 Sedang</option>
                    <option value="high">🟠 Tinggi</option>
                    <option value="critical">🔴 Kritis</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tenggat</Label>
                  <Input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} className="mt-1.5" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowTaskForm(false)} className="flex-1">Batal</Button>
              <Button onClick={handleSubmitTask} className="flex-1">{editingTaskId ? "Simpan Perubahan" : "Tambah Tugas"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ====== CREATE/EDIT GROUP MODAL ====== */}
      {showGroupForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowGroupForm(false)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 slide-in-right max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: groupColor + "22" }}>
                  {groupIcon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{editingGroupId ? "Edit Grup" : "Buat Grup Baru"}</h3>
                  <p className="text-xs text-muted-foreground">Kelompokkan tugas berdasarkan kategori</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowGroupForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* Group Name */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nama Grup</Label>
                <Input
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="Contoh: Rumah, Crypto, DevOps..."
                  className="mt-1.5"
                />
              </div>

              {/* Domain */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Domain</Label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: "personal" as Domain, label: "Personal", emoji: "👤", color: "border-violet-500 bg-violet-500/10 text-violet-500" },
                    { value: "business" as Domain, label: "Bisnis", emoji: "💼", color: "border-emerald-500 bg-emerald-500/10 text-emerald-500" },
                    { value: "work" as Domain, label: "Kerja", emoji: "🔧", color: "border-sky-500 bg-sky-500/10 text-sky-500" },
                  ]).map(d => (
                    <button
                      key={d.value}
                      onClick={() => setGroupDomain(d.value)}
                      className={cn(
                        "flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition-all font-medium text-xs",
                        groupDomain === d.value
                          ? d.color + " shadow-sm scale-[1.02]"
                          : "border-border text-muted-foreground hover:border-muted-foreground/30"
                      )}
                    >
                      <span className="text-lg">{d.emoji}</span>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon picker */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Ikon</Label>
                <div className="grid grid-cols-8 gap-1.5">
                  {GROUP_ICONS.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setGroupIcon(icon)}
                      className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all",
                        groupIcon === icon
                          ? "bg-primary/15 ring-2 ring-primary scale-110"
                          : "bg-muted hover:bg-muted/80"
                      )}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color picker */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Warna</Label>
                <div className="flex flex-wrap gap-2">
                  {GROUP_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setGroupColor(color)}
                      className={cn(
                        "w-8 h-8 rounded-full transition-all",
                        groupColor === color && "ring-2 ring-offset-2 ring-offset-card scale-110"
                      )}
                      style={{ backgroundColor: color, boxShadow: groupColor === color ? `0 0 8px ${color}80` : undefined }}
                    />
                  ))}
                </div>
              </div>

              {/* Preview */}
              {groupName.trim() && (
                <div className="pt-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Preview</Label>
                  <div
                    className="rounded-xl border p-3 flex items-center gap-3"
                    style={{ borderLeftWidth: "4px", borderLeftColor: groupColor }}
                  >
                    <span className="text-xl">{groupIcon}</span>
                    <div>
                      <p className="text-sm font-semibold">{groupName}</p>
                      <DomainBadge domain={groupDomain} />
                    </div>
                    <Badge
                      variant="outline"
                      className="ml-auto text-[10px] text-white border-transparent"
                      style={{ backgroundColor: groupColor }}
                    >
                      0 tugas
                    </Badge>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowGroupForm(false)} className="flex-1">Batal</Button>
              <Button
                onClick={handleSubmitGroup}
                disabled={!groupName.trim()}
                className="flex-1 gap-2"
                style={{ backgroundColor: groupColor }}
              >
                <Plus className="w-4 h-4" />
                {editingGroupId ? "Simpan" : "Buat Grup"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
