"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { sectionTabs } from "@/lib/navigation";

/**
 * Horizontal tab strip for pages that belong to a multi-page section.
 * Scrolls horizontally on narrow screens instead of wrapping/clipping, so a
 * long tab list never pushes page content sideways.
 */
export function SectionTabs() {
  const pathname = usePathname();
  const result = sectionTabs(pathname);
  if (!result) return null;

  const { section, items } = result;

  return (
    <div data-section-tabs className="-mx-4 mb-4 border-b border-border px-4 md:-mx-6 md:px-6">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3 py-2.5 text-xs font-medium transition-colors md:text-sm",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.tabLabel || item.label}</span>
              {isActive && <span className="absolute inset-x-1 -bottom-px h-[2px] rounded-full bg-primary" />}
            </Link>
          );
        })}
        <span className="sr-only">Bagian {section.label}</span>
      </div>
    </div>
  );
}
