"use client"

import { useAppStore } from "@/lib/store"
import type { Domain, ProjectStatus } from "@/lib/mock-data"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/status-badge"
import { DomainBadge } from "@/components/shared/domain-badge"
import { FolderKanban, Calendar, Filter } from "lucide-react"
import { cn } from "@/lib/utils"

export default function ProjectsPage() {
  const projects = useAppStore(s => s.projects)
  const [filterDomain, setFilterDomain] = useState<Domain | "all">("all")
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | "all">("all")

  const filtered = projects.filter(p => {
    if (filterDomain !== "all" && p.domain !== filterDomain) return false
    if (filterStatus !== "all" && p.status !== filterStatus) return false
    return true
  })

  return (
    <div className="space-y-6 fade-in-up">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Proyek</h1>
        <p className="text-muted-foreground text-xs md:text-sm mt-1">Pelacakan proyek jangka panjang dengan status progres</p>
      </div>

      {/* Filters */}
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

      {/* Project Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((project, i) => (
          <Card key={project.id} className={cn("hover:shadow-lg transition-all duration-300 group hover:-translate-y-0.5", project.status === "archived" && "opacity-60")} style={{ animationDelay: `${i * 80}ms` }}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <FolderKanban className="w-4 h-4 text-primary" />
                  </div>
                  <CardTitle className="text-base">{project.title}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={project.status} />
                <DomainBadge domain={project.domain} />
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                Dibuat: {new Date(project.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-muted-foreground">
            Tidak ada proyek yang cocok dengan filter
          </div>
        )}
      </div>
    </div>
  )
}
