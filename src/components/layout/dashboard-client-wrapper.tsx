"use client"

import dynamic from "next/dynamic"

// Wrapper ini adalah Client Component — membolehkan penggunaan ssr: false
// better-auth/react menginisialisasi React context di module level,
// yang crash saat SSR dengan React 19. Disable SSR memperbaiki ini.
const DashboardShellNoSSR = dynamic(
  () => import("@/components/layout/dashboard-shell").then((mod) => ({ default: mod.DashboardShell })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Memuat dashboard...</p>
        </div>
      </div>
    ),
  }
)

export function DashboardClientWrapper({ children }: { children: React.ReactNode }) {
  return <DashboardShellNoSSR>{children}</DashboardShellNoSSR>
}
