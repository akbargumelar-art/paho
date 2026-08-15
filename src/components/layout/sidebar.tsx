"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useSidebarStore } from "@/lib/sidebar-store"
import {
  LayoutDashboard, ListTodo, FolderKanban, Cpu, ScrollText,
  ShieldCheck, BookOpen, ClipboardCheck, ChevronLeft, ChevronRight, Zap, X,
  MessageSquare, FileJson, Bell, Network, Boxes, Menu, Sunrise, BarChart3, KanbanSquare, FolderOpen, TerminalSquare
} from "lucide-react"

type MenuItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
}

type MenuGroup = {
  title: string
  items: MenuItem[]
}

const menuGroups: MenuGroup[] = [
  {
    title: "Utama",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/brief", label: "Morning Brief", icon: Sunrise },
      { href: "/dashboard/insights", label: "Insights & Tampilan", icon: BarChart3 },
      { href: "/dashboard/models", label: "Model Management", icon: Cpu },
      { href: "/dashboard/kanban", label: "Kanban Task", icon: KanbanSquare },
      { href: "/dashboard/files", label: "File Browser", icon: FolderOpen },
      { href: "/dashboard/console", label: "Console Aman", icon: TerminalSquare }
    ],
  },
  {
    title: "Chat & Project",
    items: [
      { href: "/dashboard/chat", label: "Chat", icon: MessageSquare },
      { href: "/dashboard/project-contexts", label: "Project Context", icon: FolderKanban },
      { href: "/dashboard/projects", label: "Proyek Live", icon: FolderKanban },
    ],
  },
  {
    title: "Agents",
    items: [
      { href: "/dashboard/agents", label: "Agent Map", icon: Network },
      { href: "/dashboard/hermes", label: "Hermes", icon: Boxes },
      { href: "/dashboard/openclaw", label: "OpenClaw Editor", icon: FileJson },
    ],
  },
  {
    title: "Workflows",
    items: [
      { href: "/dashboard/tasks", label: "Tugas & Pengingat", icon: ListTodo },
      { href: "/dashboard/reminders", label: "Reminder Center", icon: Bell },
      { href: "/dashboard/jobs", label: "Jobs & Handoff", icon: Cpu },
      { href: "/dashboard/logs", label: "Log Eksekusi", icon: ScrollText },
    ],
  },
  {
    title: "Governance",
    items: [
      { href: "/dashboard/approvals", label: "Approval & Guardrails", icon: ShieldCheck },
      { href: "/dashboard/policy", label: "Kebijakan Model", icon: BookOpen },
      { href: "/dashboard/pilot", label: "Evaluasi Pilot", icon: ClipboardCheck },
    ],
  },
]

const mobileTabItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/chat", label: "Chat", icon: MessageSquare },
  { href: "/dashboard/tasks", label: "Tugas", icon: ListTodo },
  { href: "/dashboard/reminders", label: "Reminder", icon: Bell },
]

function isRouteActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href
  if (href === "/dashboard/hermes") return pathname === href || pathname.startsWith(`${href}/`) || pathname === "/dashboard/hermes-manager" || pathname.startsWith("/dashboard/hermes-manager/")
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function Sidebar() {
  const pathname = usePathname()
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebarStore()

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed left-0 top-0 z-50 h-screen border-r border-border bg-sidebar transition-all duration-300 flex flex-col",
        // Desktop: show normally, respond to collapsed
        "max-md:translate-x-[-100%]",
        collapsed ? "md:w-[68px]" : "md:w-[260px]",
        // Mobile: overlay style
        mobileOpen && "max-md:translate-x-0 max-md:w-[280px] max-md:shadow-2xl",
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 shrink-0">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          {(!collapsed || mobileOpen) && (
            <div className="fade-in-up flex-1 min-w-0">
              <h1 className="text-sm font-bold tracking-tight">ASPRI</h1>
              <p className="text-[10px] text-muted-foreground">Personal Assistant Gateway</p>
            </div>
          )}
          {/* Mobile close button */}
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-4 overflow-y-auto">
          {menuGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              {(!collapsed || mobileOpen) ? (
                <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
                  {group.title}
                </div>
              ) : (
                <div className="mx-auto mb-2 h-px w-8 bg-border" />
              )}

              {group.items.map((item) => {
                const isActive = isRouteActive(pathname, item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed && !mobileOpen ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                      isActive
                        ? "bg-primary/10 text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                    )}
                    <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-primary")} />
                    {(!collapsed || mobileOpen) && <span className="truncate">{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="p-3 border-t border-border shrink-0 hidden md:block">
          <button
            onClick={toggleCollapsed}
            className="flex items-center justify-center w-full h-9 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>
    </>
  )
}

export function MobileTabBar() {
  const pathname = usePathname()
  const setMobileOpen = useSidebarStore(s => s.setMobileOpen)
  const hasActiveTab = mobileTabItems.some(item => isRouteActive(pathname, item.href))

  return (
    <nav className="dashboard-mobile-tabbar md:hidden" aria-label="Navigasi utama mobile">
      {mobileTabItems.map((item) => {
        const isActive = isRouteActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn("dashboard-mobile-tab", isActive && "is-active")}
            aria-current={isActive ? "page" : undefined}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        )
      })}
      <button
        type="button"
        className={cn("dashboard-mobile-tab", !hasActiveTab && "is-active")}
        onClick={() => setMobileOpen(true)}
        aria-label="Buka menu lengkap"
      >
        <Menu className="h-5 w-5" />
        <span>Menu</span>
      </button>
    </nav>
  )
}
