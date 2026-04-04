import { create } from 'zustand'
import type {
  Task, Reminder, Project, HandoffJob, ExecutionLog,
  ApprovalGuardrail, PilotEvaluationItem, TaskGroup, ModelPolicy, DashboardMetrics
} from './mock-data'

interface AppStore {
  // Data
  tasks: Task[]
  taskGroups: TaskGroup[]
  reminders: Reminder[]
  projects: Project[]
  jobs: HandoffJob[]
  logs: ExecutionLog[]
  approvals: ApprovalGuardrail[]
  pilotItems: PilotEvaluationItem[]
  policies: ModelPolicy[]
  metrics: DashboardMetrics | null

  // Loading
  isLoading: boolean
  isInitialized: boolean

  // Fetch all data from API
  fetchAll: () => Promise<void>

  // Task Actions
  addTask: (task: Task) => Promise<void>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>

  // Task Group Actions
  addTaskGroup: (group: TaskGroup) => Promise<void>
  updateTaskGroup: (id: string, updates: Partial<TaskGroup>) => Promise<void>
  deleteTaskGroup: (id: string) => Promise<void>

  // Reminder Actions
  addReminder: (reminder: Reminder) => Promise<void>
  updateReminder: (id: string, updates: Partial<Reminder>) => Promise<void>

  // Approval Actions
  approveGuardrail: (id: string) => Promise<void>
  rejectGuardrail: (id: string) => Promise<void>

  // Job Actions
  addJob: (job: HandoffJob) => Promise<void>

  // Pilot Actions
  togglePilotItem: (id: string) => Promise<void>
  updatePilotNote: (id: string, note: string) => Promise<void>
}

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`)
  }
  return res.json()
}

export const useAppStore = create<AppStore>((set, get) => ({
  tasks: [],
  taskGroups: [],
  reminders: [],
  projects: [],
  jobs: [],
  logs: [],
  approvals: [],
  pilotItems: [],
  policies: [],
  metrics: null,
  isLoading: false,
  isInitialized: false,

  fetchAll: async () => {
    if (get().isLoading) return
    set({ isLoading: true })
    try {
      const [tasks, taskGroups, reminders, projects, jobs, logs, approvals, pilotItems, policies, metrics] =
        await Promise.all([
          apiFetch('/api/tasks'),
          apiFetch('/api/task-groups'),
          apiFetch('/api/reminders'),
          apiFetch('/api/projects'),
          apiFetch('/api/jobs'),
          apiFetch('/api/logs'),
          apiFetch('/api/approvals'),
          apiFetch('/api/pilot'),
          apiFetch('/api/policies'),
          apiFetch('/api/metrics'),
        ])
      set({
        tasks, taskGroups, reminders, projects, jobs, logs,
        approvals, pilotItems, policies, metrics,
        isInitialized: true,
      })
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  // ---- Task Actions ----
  addTask: async (task) => {
    set((state) => ({ tasks: [task, ...state.tasks] }))
    try {
      await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify(task) })
    } catch (err) {
      console.error('Failed to add task:', err)
      // Revert optimistic update
      set((state) => ({ tasks: state.tasks.filter(t => t.id !== task.id) }))
    }
  },

  updateTask: async (id, updates) => {
    const prev = get().tasks
    set((state) => ({
      tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t)
    }))
    try {
      await apiFetch(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(updates) })
    } catch (err) {
      console.error('Failed to update task:', err)
      set({ tasks: prev })
    }
  },

  deleteTask: async (id) => {
    const prev = get().tasks
    set((state) => ({ tasks: state.tasks.filter(t => t.id !== id) }))
    try {
      await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' })
    } catch (err) {
      console.error('Failed to delete task:', err)
      set({ tasks: prev })
    }
  },

  // ---- Task Group Actions ----
  addTaskGroup: async (group) => {
    set((state) => ({ taskGroups: [group, ...state.taskGroups] }))
    try {
      await apiFetch('/api/task-groups', { method: 'POST', body: JSON.stringify(group) })
    } catch (err) {
      console.error('Failed to add group:', err)
      set((state) => ({ taskGroups: state.taskGroups.filter(g => g.id !== group.id) }))
    }
  },

  updateTaskGroup: async (id, updates) => {
    const prev = get().taskGroups
    set((state) => ({
      taskGroups: state.taskGroups.map(g => g.id === id ? { ...g, ...updates } : g)
    }))
    try {
      await apiFetch(`/api/task-groups/${id}`, { method: 'PUT', body: JSON.stringify(updates) })
    } catch (err) {
      console.error('Failed to update group:', err)
      set({ taskGroups: prev })
    }
  },

  deleteTaskGroup: async (id) => {
    const prevGroups = get().taskGroups
    const prevTasks = get().tasks
    set((state) => ({
      taskGroups: state.taskGroups.filter(g => g.id !== id),
      tasks: state.tasks.map(t => t.groupId === id ? { ...t, groupId: null } : t)
    }))
    try {
      await apiFetch(`/api/task-groups/${id}`, { method: 'DELETE' })
    } catch (err) {
      console.error('Failed to delete group:', err)
      set({ taskGroups: prevGroups, tasks: prevTasks })
    }
  },

  // ---- Reminder Actions ----
  addReminder: async (reminder) => {
    set((state) => ({ reminders: [reminder, ...state.reminders] }))
    try {
      await apiFetch('/api/reminders', { method: 'POST', body: JSON.stringify(reminder) })
    } catch (err) {
      console.error('Failed to add reminder:', err)
      set((state) => ({ reminders: state.reminders.filter(r => r.id !== reminder.id) }))
    }
  },

  updateReminder: async (id, updates) => {
    const prev = get().reminders
    set((state) => ({
      reminders: state.reminders.map(r => r.id === id ? { ...r, ...updates } : r)
    }))
    try {
      await apiFetch(`/api/reminders/${id}`, { method: 'PUT', body: JSON.stringify(updates) })
    } catch (err) {
      console.error('Failed to update reminder:', err)
      set({ reminders: prev })
    }
  },

  // ---- Approval Actions ----
  approveGuardrail: async (id) => {
    const prev = get().approvals
    const updates = { isApproved: true, reviewStatus: "approved" as const, reviewedBy: "Owner (via Dashboard)" }
    set((state) => ({
      approvals: state.approvals.map(a => a.id === id ? { ...a, ...updates } : a)
    }))
    try {
      await apiFetch(`/api/approvals/${id}`, { method: 'PUT', body: JSON.stringify(updates) })
    } catch (err) {
      console.error('Failed to approve:', err)
      set({ approvals: prev })
    }
  },

  rejectGuardrail: async (id) => {
    const prev = get().approvals
    const updates = { isApproved: false, reviewStatus: "rejected" as const, reviewedBy: "Owner (via Dashboard)" }
    set((state) => ({
      approvals: state.approvals.map(a => a.id === id ? { ...a, ...updates } : a)
    }))
    try {
      await apiFetch(`/api/approvals/${id}`, { method: 'PUT', body: JSON.stringify(updates) })
    } catch (err) {
      console.error('Failed to reject:', err)
      set({ approvals: prev })
    }
  },

  // ---- Job Actions ----
  addJob: async (job) => {
    set((state) => ({ jobs: [job, ...state.jobs] }))
    try {
      await apiFetch('/api/jobs', { method: 'POST', body: JSON.stringify(job) })
    } catch (err) {
      console.error('Failed to add job:', err)
      set((state) => ({ jobs: state.jobs.filter(j => j.id !== job.id) }))
    }
  },

  // ---- Pilot Actions ----
  togglePilotItem: async (id) => {
    const prev = get().pilotItems
    const item = prev.find(p => p.id === id)
    if (!item) return
    const newVal = !item.isPassed
    set((state) => ({
      pilotItems: state.pilotItems.map(p => p.id === id ? { ...p, isPassed: newVal } : p)
    }))
    try {
      await apiFetch(`/api/pilot/${id}`, { method: 'PUT', body: JSON.stringify({ isPassed: newVal }) })
    } catch (err) {
      console.error('Failed to toggle pilot item:', err)
      set({ pilotItems: prev })
    }
  },

  updatePilotNote: async (id, note) => {
    const prev = get().pilotItems
    set((state) => ({
      pilotItems: state.pilotItems.map(p => p.id === id ? { ...p, note } : p)
    }))
    try {
      await apiFetch(`/api/pilot/${id}`, { method: 'PUT', body: JSON.stringify({ note }) })
    } catch (err) {
      console.error('Failed to update pilot note:', err)
      set({ pilotItems: prev })
    }
  },
}))
