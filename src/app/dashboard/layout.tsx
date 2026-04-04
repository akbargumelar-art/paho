"use client"

// Layout ini sengaja Client Component agar bisa pakai ssr: false
// pada DashboardShell. Dashboard ber-auth tidak perlu SSR.
import dynamic from "next/dynamic"

const DashboardShell = dynamic(
  () => import("@/components/layout/dashboard-shell").then((m) => ({ default: m.DashboardShell })),
  {
    ssr: false,
    loading: () => (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 32, height: 32, border: "2px solid rgba(99,102,241,0.3)",
            borderTopColor: "rgb(99,102,241)", borderRadius: "50%",
            animation: "spin 0.8s linear infinite", margin: "0 auto 12px"
          }} />
          <p style={{ fontSize: 14, color: "#888" }}>Memuat dashboard...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    ),
  }
)

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>
}
