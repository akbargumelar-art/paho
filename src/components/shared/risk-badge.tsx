import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Shield, ShieldAlert, ShieldCheck } from "lucide-react"
import type { RiskLevel } from "@/lib/mock-data"

const riskConfig: Record<RiskLevel, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  low: { label: "Rendah", className: "bg-risk-low/15 text-risk-low border-risk-low/30", icon: ShieldCheck },
  medium: { label: "Sedang", className: "bg-risk-medium/15 text-risk-medium border-risk-medium/30", icon: Shield },
  high: { label: "Tinggi", className: "bg-risk-high/15 text-risk-high border-risk-high/30", icon: AlertTriangle },
  critical: { label: "Kritis", className: "bg-risk-critical/15 text-risk-critical border-risk-critical/30", icon: ShieldAlert },
}

export function RiskBadge({ level }: { level?: RiskLevel | string }) {
  const config = level ? riskConfig[level as RiskLevel] : undefined
  if (!config) return null
  const Icon = config.icon
  return (
    <Badge variant="outline" className={cn("gap-1 text-[11px] font-semibold", config.className)}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  )
}
