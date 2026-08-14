"use client"

import { useAppStore } from "@/lib/store"
import type { Domain, ProjectStatus } from "@/lib/mock-data"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/status-badge"
import { DomainBadge } from "@/components/shared/domain-badge"
import { FolderKanban, Calendar, Filter, GitBranch, Database } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

type ProjectView = {
  id: string
  title: string
  description: string
  status: ProjectStatus
  domain: Domain
  createdAt: string
  sourceType?: string
  owner?: string
}

export default function ProjectsPage() {
  const projects = useAppStore(s => s.projects) as ProjectView[]
  const [filterDomain, setFilterDomain] = useState<Domain | "all">("all")
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | "all">("all")

  const filtered = projects.filter(p => {
    if (filterDomain !== "all" && p.domain !== filterDomain) return false
    if (filterStatus !== "all" && p.status !== filterStatus) return false
    return true
  })

  const liveProjects = filtered.filter(p => p.sourceType === "assistant-projects-md")
  const metadataProjects = filtered.filter(p => p.sourceType !== "assistant-projects-md")

  const ProjectGrid = ({ items, title, live }: { items: ProjectView[]; title: string; live: boolean }) => (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {live ? <GitBranch className="w-4 h-4 text-hermes" /> : <Database className="w-4 h-4 text-openclaw" />}
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="outline" className="text-[11px]">{items.length}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{live ? 'Dibaca live dari governance/source-of-truth project reference.' : 'Metadata project layer dari Paho DB/cache.'}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((project, i) => (
            <Card key={project.id} className={cn("hover:shadow-lg transition-all duration-300 group hover:-translate-y-0.5", project.status === "archived" && "opacity-60")} style={{ animationDelay: `${i * 80}ms` }}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <FolderKanban className="w-4 h-4 text-primary" />
                    </div>
                    <CardTitle className="text-base">{project.title}</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[11px]">{project.sourceType || 'db'}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-3">{project.description}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={project.status} />
                  <DomainBadge domain={project.domain} />
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  Dibuat: {project.createdAt}
                </div>
                {project.owner && <div className="text-xs text-muted-foreground">Owner: {project.owner}</div>}
              </CardContent>
            </Card>
          ))}
          {items.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground text-sm">
              Tidak ada proyek pada section ini
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6 fade-in-up">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Proyek</h1>
        <p className="text-muted-foreground text-xs md:text-sm mt-1">Project layer kini dibedakan antara live governance source dan metadata cache Paho.</p>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <div className="flex gap-1">
              {(["all", "personal", "business", "work"] as const).map(d => (
                <button key={d} onClick={() => setFilterDomain(d)} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors", filterDomain === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                  {d === "all" ? "Semua Domain" : d === "personal" ? "Personal" : d === "business" ? "Bisnis" : "Kerja"}
                </button>
              ))}
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="flex gap-1">
              {(["all", "planning", "active", "archived"] as const).map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors", filterStatus === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                  {s === "all" ? "Semua Status" : s === "planning" ? "Perencanaan" : s === "active" ? "Aktif" : "Arsip"}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <ProjectGrid items={liveProjects} title="Live Governance Projects" live />
      <ProjectGrid items={metadataProjects} title="Project Metadata" live={false} />
    </div>
  )
}
