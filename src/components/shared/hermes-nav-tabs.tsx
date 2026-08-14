"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Boxes, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { href: "/dashboard/hermes", label: "Sessions", icon: MessageSquare },
  { href: "/dashboard/hermes-manager", label: "Manager", icon: Boxes },
]

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function HermesNavTabs() {
  const pathname = usePathname()
  return (
    <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1">
      {tabs.map((tab) => {
        const active = isActive(pathname, tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors md:text-sm",
              active ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
