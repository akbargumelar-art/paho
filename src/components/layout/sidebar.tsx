"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useSidebarStore } from "@/lib/sidebar-store"
import { ChevronLeft, ChevronRight, Zap, X, MoreHorizontal } from "lucide-react"
import { findSection, isHrefActive, mobileTabs, sidebarGroups } from "@/lib/navigation"

const groups = sidebarGroups()

export function Sidebar() {
  const pathname = usePathname()
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebarStore()
  const activeSection = findSection(pathname)

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed left-0 top-0 z-50 flex h-dvh flex-col border-r border-border bg-sidebar transition-all duration-300",
        "max-md:w-[86vw] max-md:max-w-[300px] max-md:translate-x-[-100%]",
        collapsed ? "md:w-[68px]" : "md:w-[260px]",
        mobileOpen && "max-md:translate-x-0 max-md:shadow-2xl",
      )}>
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          {(!collapsed || mobileOpen) && (
            <div className="fade-in-up min-w-0 flex-1">
              <h1 className="truncate text-sm font-bold tracking-tight">ASPRI</h1>
              <p className="truncate text-[10px] text-muted-foreground">Personal Assistant Gateway</p>
            </div>
          )}
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
              aria-label="Tutup menu"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {groups.map((group) => (
            <div key={group.title} className="space-y-1">
              {(!collapsed || mobileOpen) ? (
                <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
                  {group.title}
                </div>
              ) : (
                <div className="mx-auto mb-2 h-px w-8 bg-border" />
              )}

              {group.items.map((item) => {
                const isActive = activeSection
                  ? activeSection.id === item.sectionId
                  : isHrefActive(pathname, item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed && !mobileOpen ? item.label : undefined}
                    className={cn(
                      "group relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary/10 text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                    )}
                    <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
                    {(!collapsed || mobileOpen) && <span className="truncate">{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="hidden shrink-0 border-t border-border p-3 md:block">
          <button
            onClick={toggleCollapsed}
            className="flex h-9 w-full items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={collapsed ? "Perlebar sidebar" : "Perkecil sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>
    </>
  )
}

export function MobileTabBar() {
  const pathname = usePathname()
  const setMobileOpen = useSidebarStore(s => s.setMobileOpen)
  // A bottom entry lights up for its exact route only. Section membership is not
  // used here because e.g. Kanban and Chat live in different sections than some
  // of their sibling tabs, and highlighting a whole section would be misleading.
  const hasActiveTab = mobileTabs.some(item => isHrefActive(pathname, item.href))

  return (
    <nav className="dashboard-mobile-tabbar md:hidden" aria-label="Navigasi utama mobile">
      {mobileTabs.map((item) => {
        const isActive = isHrefActive(pathname, item.href)
        if (item.center) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("dashboard-mobile-tab dashboard-mobile-tab-center", isActive && "is-active")}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="dashboard-mobile-tab-badge">
                <item.icon className="h-6 w-6" />
              </span>
              <span>{item.label}</span>
            </Link>
          )
        }
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
        aria-label="Buka menu lainnya"
      >
        <MoreHorizontal className="h-5 w-5" />
        <span>Lainnya</span>
      </button>
    </nav>
  )
}
