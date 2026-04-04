import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Domain } from "@/lib/mock-data"

const domainConfig: Record<Domain, { label: string; className: string }> = {
  personal: { label: "Personal", className: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30" },
  business: { label: "Bisnis", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  work: { label: "Kerja", className: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30" },
}

export function DomainBadge({ domain }: { domain?: Domain | string }) {
  const config = domain ? domainConfig[domain as Domain] : undefined
  if (!config) return null
  return (
    <Badge variant="outline" className={cn("text-[11px] font-semibold", config.className)}>
      {config.label}
    </Badge>
  )
}
