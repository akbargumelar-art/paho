"use client"

import { useAppStore } from "@/lib/store"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ClipboardCheck, Check, Calendar, StickyNote } from "lucide-react"
import { cn } from "@/lib/utils"

export default function PilotPage() {
  const { pilotItems, togglePilotItem, updatePilotNote } = useAppStore()

  const phases = [
    { key: "initial_7_14_days" as const, label: "Fase Awal (7-14 Hari)", description: "Kriteria dasar yang harus dipenuhi untuk validasi arsitektur" },
    { key: "stabilization_30_90_days" as const, label: "Fase Stabilisasi (30-90 Hari)", description: "Kriteria lanjutan untuk memastikan konsistensi sistem jangka panjang" },
  ]

  const totalItems = pilotItems.length
  const passedItems = pilotItems.filter(p => p.isPassed).length
  const progressPercent = totalItems > 0 ? (passedItems / totalItems) * 100 : 0

  return (
    <div className="space-y-6 fade-in-up">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Evaluasi Pilot</h1>
        <p className="text-muted-foreground text-xs md:text-sm mt-1">Checklist iteratif untuk memastikan kriteria Pilot Success terpenuhi</p>
      </div>

      {/* Overall Progress */}
      <Card className="overflow-hidden">
        <CardContent className="py-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Progres Keseluruhan</h3>
                <span className="text-2xl font-bold text-primary">{passedItems}/{totalItems}</span>
              </div>
              <Progress value={progressPercent} className="h-3" />
              <p className="text-sm text-muted-foreground mt-2">
                {progressPercent === 100
                  ? "Semua kriteria terpenuhi."
                  : `${Math.round(progressPercent)}% kriteria sudah lolos, ${totalItems - passedItems} tersisa.`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Phase Sections */}
      {phases.map(phase => {
        const items = pilotItems.filter(p => p.phase === phase.key)
        const phasePassed = items.filter(p => p.isPassed).length

        return (
          <div key={phase.key} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-primary" />
                <div>
                  <h2 className="font-semibold text-lg">{phase.label}</h2>
                  <p className="text-xs text-muted-foreground">{phase.description}</p>
                </div>
              </div>
              <Badge variant="outline" className={cn("text-sm font-semibold", phasePassed === items.length ? "bg-green-500/15 text-green-500 border-green-500/30" : "bg-amber-500/15 text-amber-500 border-amber-500/30")}>
                {phasePassed}/{items.length} Lolos
              </Badge>
            </div>

            <div className="space-y-3">
              {items.map((item, i) => (
                <Card key={item.id} className={cn("transition-all duration-200", item.isPassed ? "border-green-500/30 bg-green-500/5" : "border-border")} style={{ animationDelay: `${i * 60}ms` }}>
                  <CardContent className="py-4 space-y-3">
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <button
                        onClick={() => togglePilotItem(item.id)}
                        className={cn(
                          "w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all",
                          item.isPassed
                            ? "bg-green-500 border-green-500 text-white"
                            : "border-muted-foreground/30 hover:border-primary"
                        )}
                      >
                        {item.isPassed && <Check className="w-4 h-4" />}
                      </button>

                      {/* Criteria */}
                      <div className="flex-1">
                        <p className={cn("text-sm font-medium", item.isPassed && "line-through text-muted-foreground")}>
                          {item.criteria}
                        </p>
                      </div>

                      {/* Status icon */}
                      {item.isPassed ? (
                        <Badge variant="outline" className="bg-green-500/15 text-green-500 border-green-500/30 text-[11px]">Lolos</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-500/15 text-amber-500 border-amber-500/30 text-[11px]">Belum</Badge>
                      )}
                    </div>

                    {/* Note */}
                    <div className="ml-9">
                      <div className="flex items-center gap-1 mb-1.5">
                        <StickyNote className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Catatan Evaluasi</span>
                      </div>
                      <Textarea
                        value={item.note}
                        onChange={e => updatePilotNote(item.id, e.target.value)}
                        placeholder="Tambahkan catatan evaluasi..."
                        className="text-sm min-h-[60px] bg-muted/30"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

