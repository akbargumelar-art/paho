import dynamicImport from "next/dynamic"

// SSR dimatikan untuk DashboardShell karena:
// 1. Dashboard butuh auth — tidak ada manfaat SEO dari SSR
// 2. better-auth/react menggunakan React hooks di module level yang crash saat SSR dengan React 19
const DashboardShellClient = dynamicImport(
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

export const dynamic = "force-dynamic"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShellClient>{children}</DashboardShellClient>
}
