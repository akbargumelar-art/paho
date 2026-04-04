"use client"

import { useAppStore } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookOpen, FileText, Clock, FolderOpen } from "lucide-react"

export default function PolicyPage() {
  const policies = useAppStore(s => s.policies)

  return (
    <div className="space-y-6 fade-in-up">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Kebijakan Model & Tata Kelola</h1>
        <p className="text-muted-foreground text-xs md:text-sm mt-1">
          Dokumen kebijakan dari{" "}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">/root/assistant/</code>
          {" "}— live read dari VPS
        </p>
      </div>

      {policies.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <FolderOpen className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">Belum ada dokumen kebijakan ditemukan</p>
            <p className="text-xs text-muted-foreground/60">
              File markdown di <code className="font-mono">/root/assistant/</code> akan muncul di sini
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {policies.map((policy) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const p = policy as any
            const title = p.title ?? p.name ?? "Dokumen Tanpa Judul"
            const description = p.description ?? p.path ?? ""
            const content = p.content ?? ""
            const lastModified = p.lastModified ?? p.updatedAt ?? ""
            const tier = p.tier as string | undefined
            const appliesTo = p.appliesTo as string | undefined
            const rules = Array.isArray(p.rules) ? p.rules as string[] : null

            return (
              <Card key={policy.id} className="hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {content ? <FileText className="w-5 h-5 text-primary" /> : <BookOpen className="w-5 h-5 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{title}</CardTitle>
                      {description && (
                        <CardDescription className="mt-1 text-xs font-mono truncate">{description}</CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-3">
                    {tier && (
                      <Badge variant="outline" className="text-[11px]">
                        {tier === "high" ? "High-Tier" : tier === "cheap" ? "Cheap Worker" : tier}
                      </Badge>
                    )}
                    {appliesTo && (
                      <Badge variant="outline" className="text-[11px]">
                        {appliesTo === "Both" ? "Hermes & OpenClaw" : appliesTo}
                      </Badge>
                    )}
                    {lastModified && (
                      <Badge variant="outline" className="text-[11px] gap-1 text-muted-foreground">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(lastModified).toLocaleDateString("id-ID")}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Render rules array (ModelPolicy format lama) */}
                  {rules && rules.length > 0 && (
                    <div className="space-y-2">
                      {rules.map((rule, j) => (
                        <div key={j} className="flex items-start gap-2 group">
                          <span className="text-muted-foreground shrink-0 mt-0.5">›</span>
                          <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{rule}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Render markdown content (PolicyFile format baru) */}
                  {!rules && content && (
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                      {content}
                    </pre>
                  )}
                  {!rules && !content && (
                    <p className="text-xs text-muted-foreground italic">Konten tidak tersedia</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
