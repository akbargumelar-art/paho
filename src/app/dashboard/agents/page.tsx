import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bot, BriefcaseBusiness, Heart, Network, ShieldCheck, Sparkles, Workflow, Zap } from "lucide-react"
import { promises as fs } from "fs"
import { execFile } from "child_process"
import { promisify } from "util"

export const dynamic = "force-dynamic"
export const revalidate = 0

const execFileAsync = promisify(execFile)

type AgentStatus = {
  service: string
  active: string
  pid: number | null
  gatewayState: string | null
  telegram: string | null
  whatsapp: string | null
  updatedAt: string | null
}

type Agent = {
  name: string
  system: string
  domain: string
  access: string
  service: string
  statePath?: string
  icon: typeof Bot
  tone: string
  bullets: string[]
}

const agents: Agent[] = [
  {
    name: "Corla",
    system: "Hermes default/core",
    domain: "Core coordinator",
    access: "Owner + core access",
    service: "hermes-gateway.service",
    statePath: "/root/.hermes/gateway_state.json",
    icon: Bot,
    tone: "text-hermes",
    bullets: [
      "Inbox utama Abay dan koordinator lintas domain",
      "Pemilik Obsidian/vault knowledge dan reminder utama",
      "WhatsApp hanya aktif di Corla",
      "Auxiliary compression sudah diarahkan ke model hermes",
    ],
  },
  {
    name: "Oca",
    system: "OpenClaw",
    domain: "Backend support worker",
    access: "Support/backend",
    service: "openclaw-gateway.service",
    icon: Zap,
    tone: "text-openclaw",
    bullets: [
      "Worker backend untuk tugas berat dan automation",
      "Dipakai setelah pembagian Hermes vs OpenClaw disetujui",
      "Bukan inbox utama dan bukan koordinator keputusan user-facing",
    ],
  },
  {
    name: "Gadis",
    system: "Hermes profile: gadis",
    domain: "Work Agrabudi / Telkostore",
    access: "Telegram owner-only",
    service: "hermes-gateway-gadis.service",
    statePath: "/root/.hermes/profiles/gadis/gateway_state.json",
    icon: BriefcaseBusiness,
    tone: "text-blue-500",
    bullets: [
      "PT Agrabudi Komunika, Telkostore, KPI/support/reporting kerja",
      "Personal diarahkan ke Priska atau Corla",
      "Business/SJNet diarahkan ke Bunga atau Corla",
      "WhatsApp disabled, disk-cleanup enabled",
    ],
  },
  {
    name: "Priska",
    system: "Hermes profile: priska",
    domain: "Personal",
    access: "Telegram owner-only",
    service: "hermes-gateway-priska.service",
    statePath: "/root/.hermes/profiles/priska/gateway_state.json",
    icon: Heart,
    tone: "text-rose-500",
    bullets: [
      "Agenda pribadi, reminder pribadi, rumah tangga, utilities",
      "Finance pribadi dan koordinasi personal yang diizinkan",
      "Work diarahkan ke Gadis atau Corla",
      "Business/SJNet diarahkan ke Bunga atau Corla",
    ],
  },
  {
    name: "Bunga",
    system: "Hermes profile: bunga",
    domain: "Business / Projects / SJNet",
    access: "Telegram owner-only",
    service: "hermes-gateway-bunga.service",
    statePath: "/root/.hermes/profiles/bunga/gateway_state.json",
    icon: Sparkles,
    tone: "text-emerald-500",
    bullets: [
      "Business/projects non-work, SJNet, peluang usaha",
      "Project planning dan operasional bisnis",
      "Work Agrabudi diarahkan ke Gadis atau Corla",
      "Personal diarahkan ke Priska atau Corla",
    ],
  },
]

const routing = [
  ["Pertanyaan umum / lintas domain", "Corla"],
  ["Agrabudi, Telkostore, KPI, laporan kerja", "Gadis"],
  ["Rumah, reminder pribadi, finance pribadi", "Priska"],
  ["SJNet, bisnis non-work, project usaha", "Bunga"],
  ["Backend berat, automation, worker support", "Oca melalui Corla"],
]

const guardrails = [
  "Work sensitif: report dulu, eksekusi setelah Abay setuju.",
  "Jangan campur domain tanpa alasan jelas.",
  "Corla tetap pemilik Obsidian lintas domain.",
  "WhatsApp hanya aktif di Corla.",
  "Child agents owner-only sampai ada keputusan akses tambahan.",
  "Oca hanya support/backend; jangan jadi inbox utama.",
]

async function getServiceActive(service: string) {
  try {
    const { stdout } = await execFileAsync("systemctl", ["--user", "is-active", service], { timeout: 4000 })
    return stdout.trim() || "unknown"
  } catch (error) {
    const err = error as { stdout?: string }
    return err.stdout?.trim() || "inactive"
  }
}

async function readGatewayState(path?: string) {
  if (!path) return null
  try {
    return JSON.parse(await fs.readFile(path, "utf8")) as {
      pid?: number
      gateway_state?: string
      updated_at?: string
      platforms?: Record<string, { state?: string }>
    }
  } catch {
    return null
  }
}

async function getAgentStatus(agent: Agent): Promise<AgentStatus> {
  const [active, state] = await Promise.all([
    getServiceActive(agent.service),
    readGatewayState(agent.statePath),
  ])

  return {
    service: agent.service,
    active,
    pid: state?.pid ?? null,
    gatewayState: state?.gateway_state ?? null,
    telegram: state?.platforms?.telegram?.state ?? null,
    whatsapp: state?.platforms?.whatsapp?.state ?? null,
    updatedAt: state?.updated_at ?? null,
  }
}

function StatusBadge({ status }: { status?: string | null }) {
  const normalized = status || "unknown"
  const isOk = ["active", "running", "connected"].includes(normalized)
  return <Badge variant={isOk ? "default" : "secondary"} className="text-[10px]">{normalized}</Badge>
}

export default async function AgentMapPage() {
  const statusEntries = await Promise.all(agents.map(async (agent) => [agent.name, await getAgentStatus(agent)] as const))
  const statuses = Object.fromEntries(statusEntries) as Record<string, AgentStatus>

  return (
    <div className="space-y-6 fade-in-up">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <Network className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Agent Map</h1>
            <p className="text-muted-foreground text-xs md:text-sm mt-1">
              Peta domain Corla, Oca, Gadis, Priska, dan Bunga dengan live service status.
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Source note: <span className="font-medium">/root/obsidian-vault/90 Hermes/Agent Domain Map.md</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => {
          const Icon = agent.icon
          const status = statuses[agent.name]
          return (
            <Card key={agent.name} className="h-full hover:shadow-lg hover:border-primary/30 transition-all">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className={`h-5 w-5 ${agent.tone}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{agent.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{agent.system}</p>
                    </div>
                  </div>
                  <StatusBadge status={status.active} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="text-[10px]">{agent.domain}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{agent.access}</Badge>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span>Service</span>
                    <span className="font-mono text-[10px] text-foreground">{status.service}</span>
                  </div>
                  {status.gatewayState && (
                    <div className="flex items-center justify-between gap-2">
                      <span>Gateway</span>
                      <StatusBadge status={status.gatewayState} />
                    </div>
                  )}
                  {status.telegram && (
                    <div className="flex items-center justify-between gap-2">
                      <span>Telegram</span>
                      <StatusBadge status={status.telegram} />
                    </div>
                  )}
                  {status.whatsapp && (
                    <div className="flex items-center justify-between gap-2">
                      <span>WhatsApp</span>
                      <StatusBadge status={status.whatsapp} />
                    </div>
                  )}
                  {status.pid && (
                    <div className="flex items-center justify-between gap-2">
                      <span>PID</span>
                      <span className="font-mono text-[10px] text-foreground">{status.pid}</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {agent.bullets.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary/70 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Workflow className="h-4 w-4 text-primary" /> Routing Cepat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {routing.map(([topic, target]) => (
                <div key={topic} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/50 px-3 py-2">
                  <span className="text-sm text-muted-foreground">{topic}</span>
                  <Badge variant="outline">{target}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" /> Guardrail Operasional
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {guardrails.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-500/80 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
