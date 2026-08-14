export type GuardrailClass = "telegram-safe" | "telegram-safe-with-review" | "ssh-only" | "openclaw-backend-only"

export type GuardrailResult = {
  level: GuardrailClass
  title: string
  message: string
  blockDirectUiAction?: boolean
}

export function getGuardrailForAction(action: string, context?: { riskLevel?: string; sourceType?: string }) : GuardrailResult {
  const risk = String(context?.riskLevel || "low").toLowerCase()
  const sourceType = String(context?.sourceType || "")

  if (action === "create-cron-job") {
    return {
      level: "telegram-safe-with-review",
      title: "Cron job membutuhkan review",
      message: "Cron/orchestration job bisa berdampak ke backend. Pastikan owner final tetap Hermes dan task ini memang perlu dijalankan sebagai worker/backend.",
    }
  }

  if (action === "delete-task" || action === "delete-task-group") {
    return {
      level: "telegram-safe-with-review",
      title: "Hapus data membutuhkan review",
      message: "Penghapusan task/group dapat memengaruhi dashboard dan relasi data. Pastikan ini bukan source of truth yang masih dibutuhkan.",
    }
  }

  if (action === "approve-guardrail") {
    if (risk === "critical" || risk === "high") {
      return {
        level: "telegram-safe-with-review",
        title: "Approval risiko tinggi",
        message: "Item ini berisiko tinggi/kritis. Review payload dengan hati-hati. Jika mengarah ke runtime/config aktif, gunakan SSH/manual review.",
      }
    }
    return {
      level: "telegram-safe",
      title: "Approval aman",
      message: "Approval ini masih dalam jalur aman, tetapi tetap cek payload sebelum melanjutkan.",
    }
  }

  if (action === "reject-guardrail") {
    return {
      level: "telegram-safe-with-review",
      title: "Tolak approval",
      message: "Penolakan akan mengubah jalur eksekusi item ini. Pastikan keputusan ini memang final.",
    }
  }

  if (action === "runtime-job-action") {
    if (sourceType === "runtime_openclaw_cron") {
      return {
        level: "openclaw-backend-only",
        title: "Runtime job backend-only",
        message: "Aksi ini menyentuh runtime job OpenClaw. Lanjutkan hanya jika kamu paham dampaknya ke job aktif dan benar-benar ingin mengubah runtime backend.",
      }
    }
  }

  if (action === "delete-orchestration-job") {
    return {
      level: "telegram-safe-with-review",
      title: "Hapus orchestration metadata",
      message: "Aksi ini menghapus metadata orchestration dari UI. Pastikan job ini memang tidak lagi dibutuhkan untuk koordinasi Hermes/OpenClaw.",
    }
  }

  return {
    level: "telegram-safe",
    title: "Aksi aman",
    message: "Aksi ini berada dalam jalur aman blueprint saat ini.",
  }
}

export function confirmGuardedAction(action: string, context?: { riskLevel?: string; sourceType?: string }) {
  const g = getGuardrailForAction(action, context)
  if (g.blockDirectUiAction) {
    return { ok: false, reason: `${g.title}\n\n${g.message}` }
  }
  const ok = confirm(`${g.title}\n\n${g.message}`)
  return { ok, reason: g.message }
}
