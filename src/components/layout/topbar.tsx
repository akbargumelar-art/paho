"use client"

import { useTheme } from "next-themes"
import { useAppStore } from "@/lib/store"
import { signOut } from "@/lib/auth-client"
import { useSidebarStore } from "@/lib/sidebar-store"
import { useRouter } from "next/navigation"
import { Sun, Moon, LogOut, User, Bell, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

export function Topbar() {
  const { theme, setTheme } = useTheme()
  const approvals = useAppStore(s => s.approvals)
  const toggleMobileOpen = useSidebarStore(s => s.toggleMobileOpen)
  const router = useRouter()
  const pendingCount = approvals.filter(a => a.reviewStatus === "pending").length
  const [mounted, setMounted] = useState(false)

  const handleLogout = async () => {
    await signOut()
    router.push("/login")
  }

  useEffect(() => setMounted(true), [])

  return (
    <header className="sticky top-0 z-30 h-14 md:h-16 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-4 md:px-6 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile hamburger */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden shrink-0"
          onClick={toggleMobileOpen}
        >
          <Menu className="w-5 h-5" />
        </Button>

        <div className="min-w-0">
          <h2 className="text-base md:text-lg font-semibold truncate">Selamat Datang, Admin</h2>
          <p className="text-xs text-muted-foreground hidden sm:block">
            {new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 md:gap-2 shrink-0">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative h-8 w-8 md:h-9 md:w-9">
          <Bell className="w-4 h-4" />
          {pendingCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold glow-pulse">
              {pendingCount}
            </span>
          )}
        </Button>

        {/* Theme Toggle */}
        {mounted && (
          <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        )}

        {/* User */}
        <div className="flex items-center gap-1 md:gap-2 ml-1 md:ml-2 pl-2 md:pl-3 border-l border-border">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9" onClick={handleLogout} title="Keluar">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
