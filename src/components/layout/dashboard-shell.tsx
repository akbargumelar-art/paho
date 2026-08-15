"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "@/lib/auth-client"
import { useAppStore } from "@/lib/store"
import { useSidebarStore } from "@/lib/sidebar-store"
import { MobileTabBar, Sidebar } from "@/components/layout/sidebar"
import { SectionTabs } from "@/components/layout/section-tabs"
import { Topbar } from "@/components/layout/topbar"
import { cn } from "@/lib/utils"

function hasAuthCookie() {
  if (typeof document === 'undefined') return false
  return document.cookie.includes('better-auth') || document.cookie.includes('session')
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession()
  const collapsed = useSidebarStore(s => s.collapsed)
  const { fetchAll, isInitialized } = useAppStore()
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [pendingTooLong, setPendingTooLong] = useState(false)

  useEffect(() => {
    if (!isPending) return
    const t = setTimeout(() => setPendingTooLong(true), 2500)
    return () => clearTimeout(t)
  }, [isPending])

  useEffect(() => {
    if (isPending && !pendingTooLong) return

    if (!session && !hasAuthCookie()) {
      router.replace("/login")
    } else {
      setReady(true)
      if (!isInitialized) {
        fetchAll()
      }
    }
  }, [session, isPending, pendingTooLong, router, fetchAll, isInitialized])

  if ((isPending && !pendingTooLong) || !ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Memuat dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-shell min-h-dvh bg-background max-md:bg-muted/30">
      <Sidebar />
      <div className={cn(
        "min-w-0 transition-all duration-300",
        collapsed ? "md:pl-[68px]" : "md:pl-[260px]",
        "pl-0"
      )}>
        <Topbar />
        <main className="dashboard-main min-w-0 p-4 pb-[var(--dashboard-mobile-content-bottom)] md:p-6 md:pb-6">
          <SectionTabs />
          {children}
        </main>
      </div>
      <MobileTabBar />
    </div>
  )
}
