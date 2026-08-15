"use client"

import { useTheme } from "next-themes"
import { signOut } from "@/lib/auth-client"
import { useSidebarStore } from "@/lib/sidebar-store"
import { useRouter } from "next/navigation"
import { Sun, Moon, LogOut, User, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NotificationBell } from "@/components/layout/notification-bell"
import { useEffect, useState } from "react"

export function Topbar() {
  const { theme, setTheme } = useTheme()
  const toggleMobileOpen = useSidebarStore(s => s.toggleMobileOpen)
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  const handleLogout = async () => {
    await signOut()
    router.push("/login")
  }

  useEffect(() => setMounted(true), [])

  return (
    <header className="dashboard-topbar sticky top-0 z-30 min-h-14 border-b border-border bg-background/90 backdrop-blur-md flex items-center justify-between px-3 py-2 md:h-16 md:px-6 md:py-0 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile hamburger */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-10 w-10 shrink-0 rounded-full"
          onClick={toggleMobileOpen}
          aria-label="Buka menu"
        >
          <Menu className="w-5 h-5" />
        </Button>

        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold leading-tight md:text-lg">Selamat Datang, Admin</h2>
          <p className="hidden text-xs text-muted-foreground sm:block">
            {new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
          <p className="text-[11px] leading-tight text-muted-foreground sm:hidden">
            {new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 md:gap-2">
        {/* Notifications: deadlines, reminders, cron health */}
        <NotificationBell />

        {/* Theme Toggle */}
        {mounted && (
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full md:h-9 md:w-9 md:rounded-md" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Ganti tema">
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        )}

        {/* User */}
        <div className="flex items-center gap-1 border-l border-border pl-2 md:ml-2 md:gap-2 md:pl-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 md:h-8 md:w-8">
            <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
          </div>
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full md:h-9 md:w-9 md:rounded-md" onClick={handleLogout} title="Keluar" aria-label="Keluar">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
