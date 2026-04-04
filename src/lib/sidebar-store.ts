import { create } from 'zustand'

interface SidebarStore {
  collapsed: boolean
  mobileOpen: boolean
  setCollapsed: (v: boolean) => void
  toggleCollapsed: () => void
  setMobileOpen: (v: boolean) => void
  toggleMobileOpen: () => void
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  collapsed: false,
  mobileOpen: false,
  setCollapsed: (v) => set({ collapsed: v }),
  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
  setMobileOpen: (v) => set({ mobileOpen: v }),
  toggleMobileOpen: () => set((s) => ({ mobileOpen: !s.mobileOpen })),
}))
