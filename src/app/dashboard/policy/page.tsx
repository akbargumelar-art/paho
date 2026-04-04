"use client"

import { useAppStore } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Bot, Cpu, Shield, ChevronRight, Lock } from "lucide-react"
import { cn } from "@/lib/utils"

const tierColors = {
  high: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-600 dark:text-amber-400", label: "High-Tier" },
  cheap: { bg: "bg-slate-500/10", border: "border-slate-500/30", text: "text-slate-600 dark:text-slate-400", label: "Cheap Worker" },
}

const appliesIcons = {
  Hermes: Bot,
  OpenClaw: Cpu,
  Both: Shield,
}

export default function PolicyPage() {
  const policies = useAppStore(s => s.policies)

  return (
    <div className="space-y-6 fade-in-up">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Kebijakan Model & Tata Kelola</h1>
        <p className="text-muted-foreground text-xs md:text-sm mt-1">Panduan regulasi penggunaan model AI - <span className="font-medium text-foreground/70">Hanya Baca</span></p>
      </div>

      {/* Read-only notice */}
      <Card className="border-border/50 bg-muted/30">
        <CardContent className="py-3 flex items-center gap-3">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Halaman ini bersifat <span className="font-semibold">hanya baca</span> pada MVP. Perubahan kebijakan dilakukan via SSH manual.
          </p>
        </CardContent>
      </Card>

      {/* Policy Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {policies.map((policy, i) => {
          const tier = tierColors[policy.tier as keyof typeof tierColors]
          const Icon = appliesIcons[policy.appliesTo as keyof typeof appliesIcons]

          return (
            <Card key={policy.id} className={cn("hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5", tier.border)} style={{ animationDelay: `${i * 100}ms` }}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", tier.bg)}>
                      <BookOpen className={cn("w-5 h-5", tier.text)} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{policy.title}</CardTitle>
                      <CardDescription className="mt-1">{policy.description}</CardDescription>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="outline" className={cn("text-[11px] font-semibold", tier.bg, tier.text, tier.border)}>
                    {tier.label}
                  </Badge>
                  <Badge variant="outline" className="text-[11px] gap-1">
                    <Icon className="w-3 h-3" />
                    {policy.appliesTo === "Both" ? "Hermes & OpenClaw" : policy.appliesTo}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {policy.rules.map((rule, j) => (
                    <div key={j} className="flex items-start gap-2 group">
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                      <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{rule}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
