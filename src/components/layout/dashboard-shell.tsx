"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "@/lib/auth-client"
import { useAppStore } from "@/lib/store"
import { useSidebarStore } from "@/lib/sidebar-store"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { cn } from "@/lib/utils"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession()
  const collapsed = useSidebarStore(s => s.collapsed)
  const { fetchAll, isInitialized } = useAppStore()
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (isPending) return

    if (!session) {
      router.replace("/login")
    } else {
      setReady(true)
      if (!isInitialized) {
        fetchAll()
      }
    }
  }, [session, isPending, router, fetchAll, isInitialized])

  if (isPending || !ready) {
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
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className={cn(
        "transition-all duration-300",
        collapsed ? "md:pl-[68px]" : "md:pl-[260px]",
        "pl-0"
      )}>
        <Topbar />
        <main className="p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
