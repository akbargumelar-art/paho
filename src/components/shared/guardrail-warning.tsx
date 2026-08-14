import { AlertTriangle, ShieldAlert, TerminalSquare, Bot } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GuardrailClass } from "@/lib/guardrails"

export function GuardrailWarning({ level, message }: { level: GuardrailClass; message: string }) {
  const config = level === "ssh-only"
    ? { icon: TerminalSquare, cls: "border-red-500/30 bg-red-500/10 text-red-300", label: "SSH-only" }
    : level === "telegram-safe-with-review"
      ? { icon: ShieldAlert, cls: "border-amber-500/30 bg-amber-500/10 text-amber-200", label: "Review Required" }
      : level === "openclaw-backend-only"
        ? { icon: Bot, cls: "border-sky-500/30 bg-sky-500/10 text-sky-200", label: "Backend Only" }
        : { icon: AlertTriangle, cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200", label: "Safe" }

  const Icon = config.icon
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-sm flex items-start gap-2", config.cls)}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div>
        <div className="font-semibold text-xs uppercase tracking-wide mb-1">{config.label}</div>
        <div className="text-xs leading-relaxed">{message}</div>
      </div>
    </div>
  )
}
