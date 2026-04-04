import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ApprovalPath } from "@/lib/mock-data"
import { MessageCircle, Shield, Terminal, Cpu } from "lucide-react"

const pathConfig: Record<ApprovalPath, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  "Telegram-safe": { label: "Telegram-safe", className: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30", icon: MessageCircle },
  "Telegram-safe-with-review": { label: "Telegram + Review", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30", icon: Shield },
  "SSH-only": { label: "SSH-only", className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30", icon: Terminal },
  "OpenClaw-backend-only": { label: "Backend-only", className: "bg-slate-500/15 text-slate-500 border-slate-500/30", icon: Cpu },
}

export function ApprovalPathBadge({ path }: { path: ApprovalPath }) {
  const config = pathConfig[path]
  const Icon = config.icon
  return (
    <Badge variant="outline" className={cn("gap-1 text-[11px] font-semibold", config.className)}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  )
}
