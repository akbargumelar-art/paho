import {
  LayoutDashboard, ListTodo, FolderKanban, Cpu, ScrollText,
  ShieldCheck, BookOpen, ClipboardCheck, MessageSquare, FileJson, Bell,
  Network, Boxes, Sunrise, BarChart3, KanbanSquare, FolderOpen,
  TerminalSquare, MessagesSquare, SlidersHorizontal, Briefcase, FileText,
} from "lucide-react";

export type NavIcon = typeof LayoutDashboard;

/** A single destination. When it belongs to a section it is reachable as a tab. */
export type NavItem = {
  href: string;
  /** Label used in the sidebar / bottom bar. */
  label: string;
  /** Shorter label used inside the in-page tab strip. */
  tabLabel?: string;
  icon: NavIcon;
};

/**
 * A section groups related pages behind ONE nav entry. The section's first item
 * is the entry point shown in the sidebar; every item is reachable from the
 * in-page tab strip rendered by the dashboard shell.
 *
 * Rule requested by Abay: if a page lives in a section's tabs, it must NOT
 * appear again in the sidebar or the mobile bottom bar.
 */
export type NavSection = {
  id: string;
  /** Sidebar group heading. */
  group: string;
  /** Entry label in the sidebar (may differ from the first tab's label). */
  label: string;
  icon: NavIcon;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    id: "home",
    group: "Utama",
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    id: "brief",
    group: "Utama",
    label: "Morning Brief",
    icon: Sunrise,
    items: [{ href: "/dashboard/brief", label: "Morning Brief", icon: Sunrise }],
  },
  {
    id: "chat",
    group: "Workspace",
    label: "Chat & Project",
    icon: MessageSquare,
    items: [
      { href: "/dashboard/chat", label: "Chat", tabLabel: "Chat", icon: MessageSquare },
      { href: "/dashboard/group-chat", label: "Group Chat", tabLabel: "Group", icon: MessagesSquare },
      { href: "/dashboard/project-contexts", label: "Project Context", tabLabel: "Project Context", icon: FolderKanban },
      { href: "/dashboard/projects", label: "Proyek Live", tabLabel: "Proyek Live", icon: Briefcase },
    ],
  },
  {
    id: "work",
    group: "Workspace",
    label: "Task & Workflow",
    icon: ListTodo,
    items: [
      { href: "/dashboard/kanban", label: "Kanban", tabLabel: "Kanban", icon: KanbanSquare },
      { href: "/dashboard/tasks", label: "Tugas & Pengingat", tabLabel: "Tugas", icon: ListTodo },
      { href: "/dashboard/reminders", label: "Reminder Center", tabLabel: "Reminder", icon: Bell },
      { href: "/dashboard/jobs", label: "Jobs & Handoff", tabLabel: "Jobs", icon: Cpu },
      { href: "/dashboard/outputs", label: "Output Center", tabLabel: "Output", icon: FileText },
      { href: "/dashboard/logs", label: "Log Eksekusi", tabLabel: "Log", icon: ScrollText },
    ],
  },
  {
    id: "agents",
    group: "Agents",
    label: "Agent Control",
    icon: Network,
    items: [
      { href: "/dashboard/agents", label: "Agent Map", tabLabel: "Agent Map", icon: Network },
      { href: "/dashboard/hermes", label: "Hermes", tabLabel: "Hermes", icon: Boxes },
      { href: "/dashboard/hermes-manager", label: "Hermes Manager", tabLabel: "Manager", icon: SlidersHorizontal },
      { href: "/dashboard/openclaw", label: "OpenClaw Editor", tabLabel: "OpenClaw", icon: FileJson },
    ],
  },
  {
    id: "system",
    group: "Sistem",
    label: "Sistem & Model",
    icon: BarChart3,
    items: [
      { href: "/dashboard/insights", label: "Insights & Tampilan", tabLabel: "Insights", icon: BarChart3 },
      { href: "/dashboard/models", label: "Model Management", tabLabel: "Model", icon: Cpu },
      { href: "/dashboard/files", label: "File Browser", tabLabel: "File", icon: FolderOpen },
      { href: "/dashboard/console", label: "Console Aman", tabLabel: "Console", icon: TerminalSquare },
    ],
  },
  {
    id: "governance",
    group: "Governance",
    label: "Governance",
    icon: ShieldCheck,
    items: [
      { href: "/dashboard/approvals", label: "Approval & Guardrails", tabLabel: "Approval", icon: ShieldCheck },
      { href: "/dashboard/policy", label: "Kebijakan Model", tabLabel: "Kebijakan", icon: BookOpen },
      { href: "/dashboard/pilot", label: "Evaluasi Pilot", tabLabel: "Pilot", icon: ClipboardCheck },
    ],
  },
];

/** Bottom bar on mobile only. Order requested by Abay, Chat sits in the middle
 *  as the highlighted primary action. `center: true` marks that treatment. */
export const mobileTabs: { href: string; label: string; icon: NavIcon; center?: boolean }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/brief", label: "Briefing", icon: Sunrise },
  { href: "/dashboard/chat", label: "Chat", icon: MessageSquare, center: true },
  { href: "/dashboard/kanban", label: "Kanban", icon: KanbanSquare },
];

/** Kept for compatibility with the nav-rule harness. */
export const mobileTabHrefs = mobileTabs.map((t) => t.href);

export function isHrefActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  // Guard against prefix collisions: /dashboard/hermes must not match
  // /dashboard/hermes-manager.
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The section that owns the current path, if any. */
export function findSection(pathname: string): NavSection | null {
  let best: { section: NavSection; length: number } | null = null;
  for (const section of navSections) {
    for (const item of section.items) {
      if (!isHrefActive(pathname, item.href)) continue;
      if (!best || item.href.length > best.length) best = { section, length: item.href.length };
    }
  }
  return best?.section || null;
}

/** Tab strip for the current path — only when the section has more than one tab. */
export function sectionTabs(pathname: string): { section: NavSection; items: NavItem[] } | null {
  const section = findSection(pathname);
  if (!section || section.items.length < 2) return null;
  return { section, items: section.items };
}

/** Sidebar entries grouped by heading, one entry per section. */
export function sidebarGroups() {
  const groups: { title: string; items: { href: string; label: string; icon: NavIcon; sectionId: string }[] }[] = [];
  for (const section of navSections) {
    const entry = { href: section.items[0].href, label: section.label, icon: section.icon, sectionId: section.id };
    const existing = groups.find((g) => g.title === section.group);
    if (existing) existing.items.push(entry);
    else groups.push({ title: section.group, items: [entry] });
  }
  return groups;
}
