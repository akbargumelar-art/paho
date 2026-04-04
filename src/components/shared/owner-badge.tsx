import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Bot, Cpu } from "lucide-react"

export function OwnerBadge({ owner }: { owner: "Hermes" | "OpenClaw" | "HERMES" | "OPENCLAW" | "System" }) {
  const normalized = owner.toUpperCase()
  const isHermes = normalized === "HERMES"
  const isSystem = normalized === "SYSTEM"

  return (
    <Badge className={cn(
      "gap-1 font-semibold text-[11px]",
      isHermes ? "bg-hermes/15 text-hermes border-hermes/30 hover:bg-hermes/20" :
      isSystem ? "bg-muted text-muted-foreground border-border hover:bg-muted" :
      "bg-openclaw/15 text-openclaw border-openclaw/30 hover:bg-openclaw/20"
    )} variant="outline">
      {isHermes ? <Bot className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
      {isHermes ? "Hermes" : isSystem ? "System" : "OpenClaw"}
    </Badge>
  )
}
