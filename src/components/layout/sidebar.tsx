"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useSidebarStore } from "@/lib/sidebar-store"
import {
  LayoutDashboard, ListTodo, FolderKanban, Cpu, ScrollText,
  ShieldCheck, BookOpen, ClipboardCheck, ChevronLeft, ChevronRight, Zap, X,
  MessageSquare, FileJson
} from "lucide-react"

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/hermes", label: "Hermes Chat", icon: MessageSquare },
  { href: "/dashboard/openclaw", label: "OpenClaw Editor", icon: FileJson },
  { href: "/dashboard/tasks", label: "Tugas & Pengingat", icon: ListTodo },
  { href: "/dashboard/projects", label: "Proyek", icon: FolderKanban },
  { href: "/dashboard/jobs", label: "Jobs & Handoff", icon: Cpu },
  { href: "/dashboard/logs", label: "Log Eksekusi", icon: ScrollText },
  { href: "/dashboard/approvals", label: "Approval & Guardrails", icon: ShieldCheck },
  { href: "/dashboard/policy", label: "Kebijakan Model", icon: BookOpen },
  { href: "/dashboard/pilot", label: "Evaluasi Pilot", icon: ClipboardCheck },
]

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
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
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
