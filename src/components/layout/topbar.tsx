"use client"

import { useTheme } from "next-themes"
import { signOut } from "@/lib/auth-client"
import { useSidebarStore } from "@/lib/sidebar-store"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Sun, Moon, LogOut, User, Menu, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NotificationBell } from "@/components/layout/notification-bell"
import { useEffect, useRef, useState } from "react"

export function Topbar() {
  const { theme, setTheme } = useTheme()
  const toggleMobileOpen = useSidebarStore(s => s.toggleMobileOpen)
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [profile, setProfile] = useState<{ name: string; username: string; hasAvatar: boolean } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleLogout = async () => {
    await signOut()
    router.push("/login")
  }

  useEffect(() => setMounted(true), [])

  // Load the display name + avatar so the topbar reflects profile edits.
  useEffect(() => {
    let alive = true
    fetch("/api/profile", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (alive && json?.profile) setProfile({ name: json.profile.name, username: json.profile.username, hasAvatar: json.profile.hasAvatar }) })
      .catch(() => undefined)
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey) }
  }, [menuOpen])

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
          <h2 className="truncate text-sm font-semibold leading-tight md:text-lg">
            Selamat Datang, {profile?.name || "Admin"}
          </h2>
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

        {/* User menu */}
        <div ref={menuRef} className="relative flex items-center gap-1 border-l border-border pl-2 md:ml-2 md:gap-2 md:pl-3">
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary/20 transition hover:ring-2 hover:ring-primary/40 md:h-8 md:w-8"
            aria-label="Menu profil"
            aria-expanded={menuOpen}
          >
            {profile?.hasAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/api/profile/image?kind=avatar" alt="Foto profil" className="h-full w-full object-cover" />
            ) : (
              <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
            )}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
              <div className="border-b border-border px-3 py-2.5">
                <p className="truncate text-sm font-medium">{profile?.name || "Admin"}</p>
                {profile?.username && <p className="truncate text-[11px] text-muted-foreground">@{profile.username}</p>}
              </div>
              <Link
                href="/dashboard/profile"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm transition hover:bg-accent"
              >
                <Settings className="h-4 w-4 text-muted-foreground" /> Manajemen Profil
              </Link>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); void handleLogout() }}
                className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-sm text-destructive transition hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" /> Keluar
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
