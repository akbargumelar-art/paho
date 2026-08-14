"use client"

import { CheckCircle2, AlertCircle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

export type ActionToastState = {
  type: "success" | "error" | "info"
  message: string
} | null

export function ActionToast({ toast }: { toast: ActionToastState }) {
  if (!toast) return null

  const Icon = toast.type === "success" ? CheckCircle2 : toast.type === "error" ? AlertCircle : Info

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-[80] max-w-sm rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm",
        toast.type === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
        toast.type === "error" && "border-red-500/30 bg-red-500/10 text-red-200",
        toast.type === "info" && "border-sky-500/30 bg-sky-500/10 text-sky-200",
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="text-sm leading-relaxed">{toast.message}</div>
      </div>
    </div>
  )
}
