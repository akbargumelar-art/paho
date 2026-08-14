// ============================================================
// MOCK DATA — Personal Assistant Gateway
// Semua data simulasi untuk Phase 1 MVP
// ============================================================

export type Domain = "personal" | "business" | "work"
export type RiskLevel = "low" | "medium" | "high" | "critical"
export type TaskStatus = "pending" | "in-progress" | "completed"
export type ReminderStatus = "active" | "completed" | "archived"
export type RepeatInterval = "none" | "daily" | "weekly" | "monthly" | "yearly"
export type ProjectStatus = "planning" | "active" | "archived"
export type JobType = "cron" | "polling" | "subagent_task"
export type JobStatus = "queued" | "running" | "waiting_approval" | "done"
export type LogLevel = "INFO" | "WARN" | "ERROR" | "CRITICAL"
export type LogSource = "Hermes" | "OpenClaw" | "System"
export type ApprovalPath = "Telegram-safe" | "Telegram-safe-with-review" | "SSH-only" | "OpenClaw-backend-only"
export type ReviewStatus = "pending" | "approved" | "rejected"
export type PilotPhase = "initial_7_14_days" | "stabilization_30_90_days"

// ---- TASK GROUPS ----
export interface TaskGroup {
  id: string
  name: string
  domain: Domain
  color: string
  icon: string
  createdAt: string
}

export const mockTaskGroups: TaskGroup[] = [
  { id: "g-001", name: "Rumah", domain: "personal", color: "#8b5cf6", icon: "🏠", createdAt: "2026-03-25" },
  { id: "g-002", name: "Hobi & Side Project", domain: "personal", color: "#ec4899", icon: "🎨", createdAt: "2026-03-26" },
  { id: "g-003", name: "Crypto & Investasi", domain: "business", color: "#f59e0b", icon: "📈", createdAt: "2026-03-20" },
  { id: "g-004", name: "Operasional", domain: "business", color: "#10b981", icon: "⚙️", createdAt: "2026-03-15" },
  { id: "g-005", name: "DevOps & Infra", domain: "work", color: "#3b82f6", icon: "🖥️", createdAt: "2026-03-10" },
  { id: "g-006", name: "Freelance", domain: "work", color: "#6366f1", icon: "💼", createdAt: "2026-03-18" },
  { id: "g-007", name: "Keamanan", domain: "work", color: "#ef4444", icon: "🛡️", createdAt: "2026-03-22" },
]

// ---- TASKS (Hermes-owned) ----
export interface Task {
  id: string
  title: string
  details: string
  status: TaskStatus
  owner: "HERMES"
  domain: Domain
  groupId: string | null
  riskLevel: RiskLevel
  dueDate: string
  createdAt: string
}

export interface TaskHistoryItem {
  id: string
  taskId: string
  action: "created" | "updated" | "deleted" | "status_changed"
  title: string
  status: string
  domain: Domain
  timestamp: string
  note?: string
  sourceType?: string
}

export const mockTasks: Task[] = [
  { id: "t-001", title: "Riset tren pasar crypto mingguan", details: "Kumpulkan data harga BTC, ETH, SOL dari CoinGecko API setiap hari Senin dan buat ringkasan.", status: "in-progress", owner: "HERMES", domain: "business", groupId: "g-003", riskLevel: "medium", dueDate: "2026-04-10", createdAt: "2026-04-01" },
  { id: "t-002", title: "Backup database personal notes", details: "Jalankan backup otomatis ke cloud storage setiap minggu.", status: "pending", owner: "HERMES", domain: "personal", groupId: "g-001", riskLevel: "low", dueDate: "2026-04-07", createdAt: "2026-04-01" },
  { id: "t-003", title: "Review kontrak freelance project", details: "Periksa detail pembayaran dan deadline pada kontrak baru.", status: "pending", owner: "HERMES", domain: "work", groupId: "g-006", riskLevel: "high", dueDate: "2026-04-05", createdAt: "2026-04-02" },
  { id: "t-004", title: "Update portofolio website", details: "Tambahkan 3 project terbaru ke halaman portfolio.", status: "completed", owner: "HERMES", domain: "work", groupId: "g-006", riskLevel: "low", dueDate: "2026-04-03", createdAt: "2026-03-28" },
  { id: "t-005", title: "Konfigurasi monitoring VPS", details: "Setup uptime monitoring dan alert untuk semua service aktif.", status: "in-progress", owner: "HERMES", domain: "work", groupId: "g-005", riskLevel: "critical", dueDate: "2026-04-06", createdAt: "2026-04-02" },
  { id: "t-006", title: "Riset tools AI terbaru", details: "Evaluasi tools AI baru untuk automasi content creation.", status: "pending", owner: "HERMES", domain: "personal", groupId: "g-002", riskLevel: "low", dueDate: "2026-04-12", createdAt: "2026-04-03" },
  { id: "t-007", title: "Bayar tagihan hosting bulanan", details: "Perpanjang hosting VPS untuk bulan April.", status: "pending", owner: "HERMES", domain: "business", groupId: "g-004", riskLevel: "medium", dueDate: "2026-04-08", createdAt: "2026-04-03" },
  { id: "t-008", title: "Laporan keuangan Q1 2026", details: "Kompilasi income dan expenses untuk kuartal pertama.", status: "in-progress", owner: "HERMES", domain: "business", groupId: "g-004", riskLevel: "high", dueDate: "2026-04-15", createdAt: "2026-04-01" },
  { id: "t-009", title: "Setup CI/CD pipeline baru", details: "Konfigurasi GitHub Actions untuk deployment otomatis.", status: "pending", owner: "HERMES", domain: "work", groupId: "g-005", riskLevel: "high", dueDate: "2026-04-09", createdAt: "2026-04-04" },
  { id: "t-010", title: "Perbaiki bug notifikasi Telegram", details: "Debug dan fix issue notifikasi yang tidak terkirim.", status: "completed", owner: "HERMES", domain: "work", groupId: "g-005", riskLevel: "medium", dueDate: "2026-04-02", createdAt: "2026-03-30" },
  { id: "t-011", title: "Tulis artikel blog teknis", details: "Draft artikel tentang arsitektur microservices.", status: "pending", owner: "HERMES", domain: "personal", groupId: "g-002", riskLevel: "low", dueDate: "2026-04-20", createdAt: "2026-04-04" },
  { id: "t-012", title: "Audit keamanan API endpoints", details: "Lakukan pengecekan keamanan pada seluruh endpoint yang terbuka.", status: "pending", owner: "HERMES", domain: "work", groupId: "g-007", riskLevel: "critical", dueDate: "2026-04-11", createdAt: "2026-04-04" },
]

// ---- REMINDERS (Hermes-owned) ----
export interface Reminder {
  id: string
  taskId: string | null
  title: string
  triggerTime: string
  isActive: boolean
  owner: "HERMES"
  domain: Domain
  status: ReminderStatus
  repeat?: RepeatInterval
  runtimeMode?: "plan_only" | "hermes_cron"
  runtimeJobId?: string | null
  sourceType?: string
  responsePreview?: string
  outputPath?: string
}

export const mockReminders: Reminder[] = [
  { id: "r-001", taskId: "t-001", title: "Jalankan riset crypto mingguan", triggerTime: "2026-04-07T09:00:00", isActive: true, owner: "HERMES", domain: "business", status: "active", repeat: "weekly" },
  { id: "r-002", taskId: "t-002", title: "Reminder backup database", triggerTime: "2026-04-07T02:00:00", isActive: true, owner: "HERMES", domain: "personal", status: "active", repeat: "weekly" },
  { id: "r-003", taskId: "t-003", title: "Deadline review kontrak", triggerTime: "2026-04-05T18:00:00", isActive: true, owner: "HERMES", domain: "work", status: "active" },
  { id: "r-004", taskId: "t-007", title: "Bayar hosting sebelum expired", triggerTime: "2026-04-08T08:00:00", isActive: true, owner: "HERMES", domain: "business", status: "active" },
  { id: "r-005", taskId: null, title: "Review log mingguan", triggerTime: "2026-04-06T20:00:00", isActive: true, owner: "HERMES", domain: "work", status: "active" },
  { id: "r-006", taskId: "t-008", title: "Finalisasi laporan Q1", triggerTime: "2026-04-15T10:00:00", isActive: true, owner: "HERMES", domain: "business", status: "active" },
  { id: "r-007", taskId: null, title: "Cek update security patch", triggerTime: "2026-04-04T12:00:00", isActive: false, owner: "HERMES", domain: "work", status: "completed" },
  { id: "r-008", taskId: null, title: "Istirahat dan olahraga", triggerTime: "2026-04-04T17:00:00", isActive: true, owner: "HERMES", domain: "personal", status: "active" },
]

// ---- PROJECTS ----
export interface Project {
  id: string
  title: string
  description: string
  status: ProjectStatus
  domain: Domain
  createdAt: string
}

export const mockProjects: Project[] = [
  { id: "p-001", title: "Personal Assistant Gateway", description: "Membangun sistem dashboard untuk mengelola ekosistem AI assistant Hermes & OpenClaw.", status: "active", domain: "work", createdAt: "2026-03-15" },
  { id: "p-002", title: "Crypto Portfolio Tracker", description: "Sistem tracking portofolio crypto dengan analisis otomatis dan alert harga.", status: "active", domain: "business", createdAt: "2026-02-20" },
  { id: "p-003", title: "Blog Pribadi v3", description: "Redesign blog pribadi dengan Next.js dan content management system.", status: "planning", domain: "personal", createdAt: "2026-03-25" },
  { id: "p-004", title: "SaaS MVP - InvoiceGen", description: "Minimum viable product untuk aplikasi generate invoice otomatis.", status: "active", domain: "business", createdAt: "2026-01-10" },
  { id: "p-005", title: "Arsip Dokumentasi Internal", description: "Knowledge base internal untuk semua SOP dan dokumentasi teknis.", status: "archived", domain: "work", createdAt: "2025-11-01" },
]

// ---- HANDOFF JOBS (OpenClaw-owned) ----
export interface HandoffJob {
  id: string
  taskId: string
  contextPack: { instruction: string; dataSource: string; schedule: string }
  worker: "OPENCLAW"
  jobType: JobType
  status: JobStatus
  returnOutput: string | null
  domain: Domain
  ownerFinal: "Hermes" | "OpenClaw"
  returnPath: string
  approvalPath: ApprovalPath
  riskLevel: RiskLevel
}

export const mockJobs: HandoffJob[] = [
  { id: "j-001", taskId: "t-001", contextPack: { instruction: "Polling harga crypto harian", dataSource: "CoinGecko API", schedule: "0 9 * * 1" }, worker: "OPENCLAW", jobType: "polling", status: "running", returnOutput: null, domain: "business", ownerFinal: "Hermes", returnPath: "Dashboard -> Task t-001", approvalPath: "Telegram-safe", riskLevel: "low" },
  { id: "j-002", taskId: "t-002", contextPack: { instruction: "Backup database ke cloud", dataSource: "SQLite DB", schedule: "0 2 * * 0" }, worker: "OPENCLAW", jobType: "cron", status: "done", returnOutput: "Backup selesai: 2026-04-01, 42MB uploaded", domain: "personal", ownerFinal: "Hermes", returnPath: "Dashboard -> Task t-002", approvalPath: "Telegram-safe", riskLevel: "low" },
  { id: "j-003", taskId: "t-005", contextPack: { instruction: "Setup monitoring daemon", dataSource: "VPS System", schedule: "*/5 * * * *" }, worker: "OPENCLAW", jobType: "cron", status: "waiting_approval", returnOutput: null, domain: "work", ownerFinal: "OpenClaw", returnPath: "System Config", approvalPath: "SSH-only", riskLevel: "critical" },
  { id: "j-004", taskId: "t-008", contextPack: { instruction: "Scrape data transaksi dari bank API", dataSource: "Bank API", schedule: "0 8 1 * *" }, worker: "OPENCLAW", jobType: "subagent_task", status: "running", returnOutput: null, domain: "business", ownerFinal: "Hermes", returnPath: "Dashboard -> Task t-008", approvalPath: "Telegram-safe-with-review", riskLevel: "high" },
  { id: "j-005", taskId: "t-009", contextPack: { instruction: "Setup GitHub Actions pipeline", dataSource: "GitHub API", schedule: "one-time" }, worker: "OPENCLAW", jobType: "subagent_task", status: "queued", returnOutput: null, domain: "work", ownerFinal: "Hermes", returnPath: "Dashboard -> Task t-009", approvalPath: "SSH-only", riskLevel: "high" },
  { id: "j-006", taskId: "t-010", contextPack: { instruction: "Test Telegram notifications", dataSource: "Telegram Bot API", schedule: "one-time" }, worker: "OPENCLAW", jobType: "subagent_task", status: "done", returnOutput: "Bug fixed: token refresh issue resolved", domain: "work", ownerFinal: "Hermes", returnPath: "Dashboard -> Task t-010", approvalPath: "Telegram-safe", riskLevel: "medium" },
  { id: "j-007", taskId: "t-012", contextPack: { instruction: "Scan API endpoints untuk vulnerabilities", dataSource: "Internal API Registry", schedule: "0 3 * * *" }, worker: "OPENCLAW", jobType: "cron", status: "waiting_approval", returnOutput: null, domain: "work", ownerFinal: "OpenClaw", returnPath: "Security Report", approvalPath: "Telegram-safe-with-review", riskLevel: "critical" },
  { id: "j-008", taskId: "t-006", contextPack: { instruction: "Collect AI tools data dari ProductHunt", dataSource: "ProductHunt API", schedule: "0 10 * * *" }, worker: "OPENCLAW", jobType: "polling", status: "running", returnOutput: null, domain: "personal", ownerFinal: "Hermes", returnPath: "Dashboard -> Task t-006", approvalPath: "OpenClaw-backend-only", riskLevel: "low" },
]

// ---- EXECUTION LOGS ----
export interface ExecutionLog {
  id: string
  jobId: string | null
  message: string
  level: LogLevel
  source: LogSource
  owner: "Hermes" | "OpenClaw"
  domain: Domain
  approvalPath: ApprovalPath | null
  status: "success" | "failed" | "pending"
  metadata: { context?: string; duration?: string; endpoint?: string }
  timestamp: string
}

export const mockLogs: ExecutionLog[] = [
  { id: "l-001", jobId: "j-001", message: "Polling CoinGecko API berhasil - 15 data points retrieved", level: "INFO", source: "OpenClaw", owner: "OpenClaw", domain: "business", approvalPath: "Telegram-safe", status: "success", metadata: { endpoint: "api.coingecko.com/simple/price", duration: "1.2s" }, timestamp: "2026-04-04T09:15:00" },
  { id: "l-002", jobId: "j-002", message: "Database backup completed successfully", level: "INFO", source: "OpenClaw", owner: "OpenClaw", domain: "personal", approvalPath: "Telegram-safe", status: "success", metadata: { duration: "45s", context: "Weekly backup" }, timestamp: "2026-04-01T02:00:45" },
  { id: "l-003", jobId: "j-003", message: "Monitoring daemon memerlukan akses root - menunggu approval SSH", level: "WARN", source: "OpenClaw", owner: "OpenClaw", domain: "work", approvalPath: "SSH-only", status: "pending", metadata: { context: "Requires systemctl access" }, timestamp: "2026-04-04T08:30:00" },
  { id: "l-004", jobId: null, message: "Task t-004 ditandai selesai oleh Hermes", level: "INFO", source: "Hermes", owner: "Hermes", domain: "work", approvalPath: null, status: "success", metadata: { context: "Portfolio update completed" }, timestamp: "2026-04-03T14:20:00" },
  { id: "l-005", jobId: "j-004", message: "Bank API rate limit exceeded - retry in 60s", level: "WARN", source: "OpenClaw", owner: "OpenClaw", domain: "business", approvalPath: "Telegram-safe-with-review", status: "pending", metadata: { endpoint: "api.bank.co.id/transactions", duration: "timeout" }, timestamp: "2026-04-04T08:05:00" },
  { id: "l-006", jobId: "j-006", message: "Telegram bot token refresh successful", level: "INFO", source: "OpenClaw", owner: "OpenClaw", domain: "work", approvalPath: "Telegram-safe", status: "success", metadata: { duration: "0.3s" }, timestamp: "2026-04-02T16:45:00" },
  { id: "l-007", jobId: null, message: "Hermes scheduler: 3 reminders triggered", level: "INFO", source: "Hermes", owner: "Hermes", domain: "personal", approvalPath: null, status: "success", metadata: { context: "Daily reminder batch" }, timestamp: "2026-04-04T09:00:00" },
  { id: "l-008", jobId: "j-007", message: "CRITICAL: SQL injection attempt detected on /api/users endpoint", level: "CRITICAL", source: "OpenClaw", owner: "OpenClaw", domain: "work", approvalPath: "SSH-only", status: "failed", metadata: { endpoint: "/api/users", context: "Security scan result" }, timestamp: "2026-04-04T03:15:00" },
  { id: "l-009", jobId: "j-001", message: "Crypto data parsing error: unexpected format for SOL", level: "ERROR", source: "OpenClaw", owner: "OpenClaw", domain: "business", approvalPath: "Telegram-safe", status: "failed", metadata: { endpoint: "api.coingecko.com", context: "SOL price format changed" }, timestamp: "2026-04-03T09:20:00" },
  { id: "l-010", jobId: null, message: "System health check: semua service berjalan normal", level: "INFO", source: "System", owner: "Hermes", domain: "work", approvalPath: null, status: "success", metadata: { duration: "0.5s", context: "Hourly health check" }, timestamp: "2026-04-04T10:00:00" },
  { id: "l-011", jobId: "j-005", message: "GitHub Actions: menunggu konfigurasi secrets via SSH", level: "WARN", source: "OpenClaw", owner: "OpenClaw", domain: "work", approvalPath: "SSH-only", status: "pending", metadata: { context: "Needs DEPLOY_KEY secret" }, timestamp: "2026-04-04T07:00:00" },
  { id: "l-012", jobId: "j-008", message: "ProductHunt scraping: 25 new AI tools found", level: "INFO", source: "OpenClaw", owner: "OpenClaw", domain: "personal", approvalPath: "OpenClaw-backend-only", status: "success", metadata: { duration: "3.2s", context: "Daily scrape" }, timestamp: "2026-04-04T10:05:00" },
  { id: "l-013", jobId: null, message: "Hermes: handoff context pack created untuk j-004", level: "INFO", source: "Hermes", owner: "Hermes", domain: "business", approvalPath: "Telegram-safe-with-review", status: "success", metadata: { context: "Bank data scraping delegation" }, timestamp: "2026-04-04T07:55:00" },
  { id: "l-014", jobId: "j-003", message: "ERROR: Gagal membaca /etc/systemd - permission denied", level: "ERROR", source: "OpenClaw", owner: "OpenClaw", domain: "work", approvalPath: "SSH-only", status: "failed", metadata: { context: "Requires root access via SSH" }, timestamp: "2026-04-04T08:31:00" },
  { id: "l-015", jobId: null, message: "Hermes: Notifikasi Telegram terkirim untuk 2 pending approvals", level: "INFO", source: "Hermes", owner: "Hermes", domain: "work", approvalPath: "Telegram-safe", status: "success", metadata: { context: "Approval notification batch" }, timestamp: "2026-04-04T09:30:00" },
]

// ---- APPROVAL GUARDRAILS ----
export interface ApprovalGuardrail {
  id: string
  jobId: string
  notificationMethod: "Telegram Push"
  requestPayload: string
  isApproved: boolean | null
  reviewedBy: string | null
  reviewStatus: ReviewStatus
  riskLevel: RiskLevel
  approvalChannel: ApprovalPath
}

export const mockApprovals: ApprovalGuardrail[] = [
  { id: "a-001", jobId: "j-003", notificationMethod: "Telegram Push", requestPayload: "OpenClaw membutuhkan akses root untuk setup monitoring daemon di VPS. Memerlukan modifikasi systemd service.", isApproved: null, reviewedBy: null, reviewStatus: "pending", riskLevel: "critical", approvalChannel: "SSH-only" },
  { id: "a-002", jobId: "j-004", notificationMethod: "Telegram Push", requestPayload: "OpenClaw akan mengakses Bank API untuk scraping data transaksi Q1. Data sensitif terlibat.", isApproved: null, reviewedBy: null, reviewStatus: "pending", riskLevel: "high", approvalChannel: "Telegram-safe-with-review" },
  { id: "a-003", jobId: "j-005", notificationMethod: "Telegram Push", requestPayload: "Setup CI/CD pipeline memerlukan penambahan secrets (DEPLOY_KEY) ke GitHub repository.", isApproved: null, reviewedBy: null, reviewStatus: "pending", riskLevel: "high", approvalChannel: "SSH-only" },
  { id: "a-004", jobId: "j-006", notificationMethod: "Telegram Push", requestPayload: "Refresh Telegram bot token untuk perbaikan bug notifikasi.", isApproved: true, reviewedBy: "Owner (via Telegram)", reviewStatus: "approved", riskLevel: "medium", approvalChannel: "Telegram-safe" },
  { id: "a-005", jobId: "j-007", notificationMethod: "Telegram Push", requestPayload: "ALERT: SQL injection attempt terdeteksi. OpenClaw ingin menjalankan security patch otomatis.", isApproved: null, reviewedBy: null, reviewStatus: "pending", riskLevel: "critical", approvalChannel: "Telegram-safe-with-review" },
  { id: "a-006", jobId: "j-002", notificationMethod: "Telegram Push", requestPayload: "Backup database mingguan selesai. Konfirmasi penyimpanan ke cloud storage.", isApproved: true, reviewedBy: "Owner (via Telegram)", reviewStatus: "approved", riskLevel: "low", approvalChannel: "Telegram-safe" },
]

// ---- PILOT EVALUATION ----
export interface PilotEvaluationItem {
  id: string
  criteria: string
  isPassed: boolean
  note: string
  phase: PilotPhase
}

export const mockPilotItems: PilotEvaluationItem[] = [
  { id: "pe-001", criteria: "Tidak ada reminder/tracker ganda antara Hermes dan OpenClaw", isPassed: true, note: "Verified: Semua reminder hanya ada di Hermes.", phase: "initial_7_14_days" },
  { id: "pe-002", criteria: "Output OpenClaw selalu kembali ke Hermes dengan rapi", isPassed: true, note: "Handoff return path berfungsi dengan baik.", phase: "initial_7_14_days" },
  { id: "pe-003", criteria: "Flow split Telegram vs SSH dipahami tanpa kebingungan", isPassed: false, note: "Perlu dokumentasi lebih jelas untuk approval SSH-only.", phase: "initial_7_14_days" },
  { id: "pe-004", criteria: "Tidak ada eksekusi otomasi destruktif tanpa izin", isPassed: true, note: "Guardrails berfungsi, semua aksi high-risk tertahan.", phase: "initial_7_14_days" },
  { id: "pe-005", criteria: "Label ownership Hermes/OpenClaw terlihat jelas di UI", isPassed: true, note: "Badge warna berbeda untuk setiap owner.", phase: "initial_7_14_days" },
  { id: "pe-006", criteria: "Sistem berjalan konsisten selama 30 hari tanpa kegagalan kritis", isPassed: false, note: "Belum mencapai 30 hari operasional.", phase: "stabilization_30_90_days" },
  { id: "pe-007", criteria: "Model policy dipatuhi - tidak ada penggunaan high-tier tanpa alasan", isPassed: false, note: "Perlu audit log penggunaan model.", phase: "stabilization_30_90_days" },
  { id: "pe-008", criteria: "Approval guardrails tidak pernah di-bypass", isPassed: true, note: "Semua approval melalui jalur yang benar.", phase: "stabilization_30_90_days" },
  { id: "pe-009", criteria: "Response time Hermes tetap di bawah 2 detik", isPassed: false, note: "Belum diukur secara konsisten.", phase: "stabilization_30_90_days" },
  { id: "pe-010", criteria: "Dokumentasi SOP lengkap dan ter-update", isPassed: false, note: "Draft SOP sudah ada, perlu review final.", phase: "stabilization_30_90_days" },
]

// ---- MODEL POLICIES ----
export interface ModelPolicy {
  id: string
  title: string
  description: string
  rules: string[]
  tier: "high" | "cheap"
  appliesTo: "Hermes" | "OpenClaw" | "Both"
}

export const mockPolicies: ModelPolicy[] = [
  {
    id: "mp-001",
    title: "High-Tier Path — Hermes (User-Facing)",
    description: "Model berkualitas tinggi wajib digunakan untuk semua interaksi langsung dengan pengguna.",
    rules: [
      "Semua task yang berhubungan langsung dengan pengguna WAJIB melalui high-tier model",
      "Response harus dalam bahasa yang natural dan kontekstual",
      "Tidak boleh menggunakan cheap worker untuk user-facing output",
      "Review dan approval summary harus selalu menggunakan tier tinggi"
    ],
    tier: "high",
    appliesTo: "Hermes"
  },
  {
    id: "mp-002",
    title: "High-Tier Path — OpenClaw (Backend Penting)",
    description: "OpenClaw dapat menggunakan high-tier model untuk tugas backend yang memiliki dampak signifikan.",
    rules: [
      "Security scanning dan vulnerability assessment WAJIB high-tier",
      "Data analysis yang melibatkan keputusan finansial menggunakan high-tier",
      "Hanya digunakan jika output langsung mempengaruhi keamanan atau keuangan",
      "Harus ada justifikasi tertulis di execution log"
    ],
    tier: "high",
    appliesTo: "OpenClaw"
  },
  {
    id: "mp-003",
    title: "Cheap Worker Rules — OpenClaw",
    description: "Model murah hanya boleh digunakan untuk bounded backend tasks dengan guardrails ketat.",
    rules: [
      "HANYA untuk bounded backend tasks (polling, scraping data publik, format conversion)",
      "Output harus selalu di-validate sebelum dikirim ke Hermes",
      "Tidak boleh mengakses data sensitif (credentials, financial data)",
      "Harus ada timeout dan retry limit yang ketat",
      "Jika task melebihi batas kompleksitas, HARUS eskalasi ke high-tier"
    ],
    tier: "cheap",
    appliesTo: "OpenClaw"
  },
  {
    id: "mp-004",
    title: "SOP Aturan Main — Batasan Wewenang",
    description: "Standard Operating Procedure untuk memastikan AI bekerja dalam batas wewenang yang jelas.",
    rules: [
      "Hermes: SATU-SATUNYA pengelola Task, Reminder, dan Project Tracker",
      "OpenClaw: HANYA menangani cron, polling, subagent, dan otomasi backend",
      "Dilarang membuat tracker/reminder paralel untuk OpenClaw",
      "Semua mixed task HARUS berujung kembali ke Hermes",
      "Konfigurasi sistem (.env, restart service) HANYA via SSH manual",
      "Approval via Telegram HANYA untuk jalur Telegram-safe",
      "Aksi runtime/config TIDAK DAPAT disetujui dari dashboard/Telegram"
    ],
    tier: "high",
    appliesTo: "Both"
  },
]

// ---- DASHBOARD METRICS ----
export interface DashboardMetrics {
  systemStatus: "online" | "degraded" | "offline"
  activeHermesTasks: number
  activeOpenClawJobs: number
  pendingApprovals: number
  recentLogsCount: number
  systemHealth: number
  highRiskPending: number
}

export const mockMetrics: DashboardMetrics = {
  systemStatus: "online",
  activeHermesTasks: mockTasks.filter(t => t.status !== "completed").length,
  activeOpenClawJobs: mockJobs.filter(j => j.status === "running" || j.status === "queued").length,
  pendingApprovals: mockApprovals.filter(a => a.reviewStatus === "pending").length,
  recentLogsCount: mockLogs.length,
  systemHealth: 94,
  highRiskPending: mockApprovals.filter(a => (a.riskLevel === "high" || a.riskLevel === "critical") && a.reviewStatus === "pending").length,
}
