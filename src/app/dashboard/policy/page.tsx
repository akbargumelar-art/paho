"use client"

import { useEffect, useMemo, useState } from "react"
import { useAppStore } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { BookOpen, FileText, Clock, FolderOpen, Edit, Save, X, GitCompare, ShieldCheck, ShieldAlert } from "lucide-react"
import { ActionToast, type ActionToastState } from "@/components/shared/action-toast"
import { validateBasicYaml } from "@/lib/yaml-lite"

type PolicyView = {
  id?: string
  filename?: string
  title?: string
  description?: string
  content?: string
  lastModified?: string
  updatedAt?: string
  modified_at?: string
  domain?: string
  path?: string
  tier?: string
  appliesTo?: string
  rules?: string[]
}

function buildDiff(original: string, edited: string) {
  const a = original.split("\n")
  const b = edited.split("\n")
  const max = Math.max(a.length, b.length)
  const lines: { type: "same" | "add" | "remove"; text: string }[] = []
  for (let i = 0; i < max; i++) {
    const oldLine = a[i]
    const newLine = b[i]
    if (oldLine === newLine) {
      if (oldLine !== undefined) lines.push({ type: "same", text: oldLine })
    } else {
      if (oldLine !== undefined) lines.push({ type: "remove", text: oldLine })
      if (newLine !== undefined) lines.push({ type: "add", text: newLine })
    }
  }
  return lines
}

export default function PolicyPage() {
  const policies = useAppStore(s => s.policies) as PolicyView[]
  const fetchAll = useAppStore(s => s.fetchAll)
  const [editing, setEditing] = useState<PolicyView | null>(null)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ActionToastState>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  const diff = useMemo(() => editing ? buildDiff(editing.content ?? "", draft) : [], [editing, draft])
  const yamlCheck = useMemo(() => {
    const filename = editing?.filename || ''
    if (!filename.endsWith('.yaml') && !filename.endsWith('.yml')) return null
    return validateBasicYaml(draft)
  }, [editing, draft])

  const openEditor = (policy: PolicyView) => {
    setEditing(policy)
    setDraft(policy.content ?? "")
  }

  const savePolicy = async () => {
    if (!editing?.filename) return
    if (yamlCheck && !yamlCheck.ok) {
      setToast({ type: 'error', message: yamlCheck.message })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/policies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: editing.filename, content: draft, subdir: editing.domain === 'shared' ? 'shared' : editing.domain })
      })
      if (!res.ok) throw new Error(await res.text())
      await fetchAll()
      setEditing(null)
      setToast({ type: 'success', message: `Dokumen ${editing.filename} berhasil disimpan.` })
    } catch {
      setToast({ type: 'error', message: `Gagal menyimpan dokumen ${editing?.filename || ''}.` })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 fade-in-up">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Kebijakan Model & Tata Kelola</h1>
        <p className="text-muted-foreground text-xs md:text-sm mt-1">
          Dokumen kebijakan dari <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">/root/assistant/</code> — live read dari VPS
        </p>
      </div>

      {policies.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <FolderOpen className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">Belum ada dokumen kebijakan ditemukan</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {policies.map((policy) => {
            const title = policy.title ?? policy.filename ?? "Dokumen Tanpa Judul"
            const description = policy.description ?? policy.path ?? ""
            const content = policy.content ?? ""
            const lastModified = policy.lastModified ?? policy.updatedAt ?? policy.modified_at ?? ""
            const tier = policy.tier
            const appliesTo = policy.appliesTo
            const rules = Array.isArray(policy.rules) ? policy.rules : null

            return (
              <Card key={policy.id ?? policy.filename} className="hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {content ? <FileText className="w-5 h-5 text-primary" /> : <BookOpen className="w-5 h-5 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{title}</CardTitle>
                      {description && <CardDescription className="mt-1 text-xs font-mono truncate">{description}</CardDescription>}
                    </div>
                    {policy.filename && <Button variant="outline" size="sm" onClick={() => openEditor(policy)}><Edit className="w-3.5 h-3.5 mr-1" /> Edit</Button>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-3">
                    {tier && <Badge variant="outline" className="text-[11px]">{tier === "high" ? "High-Tier" : tier === "cheap" ? "Cheap Worker" : tier}</Badge>}
                    {appliesTo && <Badge variant="outline" className="text-[11px]">{appliesTo === "Both" ? "Hermes & OpenClaw" : appliesTo}</Badge>}
                    {lastModified && <Badge variant="outline" className="text-[11px] gap-1 text-muted-foreground"><Clock className="w-2.5 h-2.5" />{new Date(lastModified).toLocaleDateString("id-ID")}</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  {rules && rules.length > 0 ? (
                    <div className="space-y-2">
                      {rules.map((rule, j) => (
                        <div key={j} className="flex items-start gap-2 group">
                          <span className="text-muted-foreground shrink-0 mt-0.5">›</span>
                          <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{rule}</p>
                        </div>
                      ))}
                    </div>
                  ) : content ? (
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">{content}</pre>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Konten tidak tersedia</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-auto">
          <div className="max-w-6xl mx-auto p-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Edit className="w-4 h-4" /> Diff-aware Editor</CardTitle>
                  <CardDescription>{editing.filename}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}><X className="w-4 h-4 mr-1" /> Close</Button>
                  <Button onClick={savePolicy} disabled={saving}><Save className="w-4 h-4 mr-1" /> {saving ? 'Saving...' : 'Save'}</Button>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">Editor</div>
                    {yamlCheck && (
                      <div className={`inline-flex items-center gap-1 text-xs ${yamlCheck.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                        {yamlCheck.ok ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                        {yamlCheck.message}
                      </div>
                    )}
                  </div>
                  <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} disabled={saving} className="min-h-[70vh] font-mono text-xs" />
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium flex items-center gap-2"><GitCompare className="w-4 h-4" /> Diff Preview</div>
                  <div className="border rounded-lg bg-muted/20 p-3 min-h-[70vh] overflow-auto font-mono text-xs space-y-1">
                    {diff.map((line, idx) => (
                      <div key={idx} className={line.type === 'add' ? 'text-emerald-400' : line.type === 'remove' ? 'text-red-400' : 'text-muted-foreground'}>
                        <span className="inline-block w-4">{line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}</span>{line.text}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <ActionToast toast={toast} />
    </div>
  )
}
