import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

type StatusType = string

const statusConfig: Record<string, { label: string; className: string }> = {
  // Task statuses
  "pending": { label: "Menunggu", className: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30" },
  "in-progress": { label: "Berjalan", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  "completed": { label: "Selesai", className: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30" },
  // Reminder statuses
  "active": { label: "Aktif", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  "archived": { label: "Diarsipkan", className: "bg-gray-500/15 text-gray-500 border-gray-500/30" },
  // Project statuses
  "planning": { label: "Perencanaan", className: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30" },
  // Job statuses
  "queued": { label: "Antrian", className: "bg-slate-500/15 text-slate-500 border-slate-500/30" },
  "running": { label: "Berjalan", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  "waiting_approval": { label: "Menunggu Approval", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  "done": { label: "Selesai", className: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30" },
  // Review
  "approved": { label: "Disetujui", className: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30" },
  "rejected": { label: "Ditolak", className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30" },
  // Log
  "success": { label: "Sukses", className: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30" },
  "failed": { label: "Gagal", className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30" },
}

export function StatusBadge({ status }: { status: StatusType }) {
  const config = statusConfig[status] || { label: status, className: "bg-muted text-muted-foreground border-border" }
  return (
    <Badge variant="outline" className={cn("text-[11px] font-semibold", config.className)}>
      {config.label}
    </Badge>
  )
}
