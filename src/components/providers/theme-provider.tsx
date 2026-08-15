"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ReactNode, useEffect } from "react"

/** Applies Paho's local visual preferences without persisting app data server-side. */
function PreferenceApplier() {
  useEffect(() => {
    const apply = () => {
      const root = document.documentElement
      const accent = localStorage.getItem("paho-accent") || "violet"
      const fontSize = localStorage.getItem("paho-font-size") || "normal"
      const compact = localStorage.getItem("paho-compact") === "true"
      root.dataset.accent = accent
      root.dataset.fontSize = fontSize
      root.dataset.compact = compact ? "true" : "false"
    }
    apply()
    window.addEventListener("paho-preferences", apply)
    return () => window.removeEventListener("paho-preferences", apply)
  }, [])
  return null
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <PreferenceApplier />
      {children}
    </NextThemesProvider>
  )
}
