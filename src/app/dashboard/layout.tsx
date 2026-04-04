import { DashboardClientWrapper } from "@/components/layout/dashboard-client-wrapper"

export const dynamic = "force-dynamic"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardClientWrapper>{children}</DashboardClientWrapper>
}
