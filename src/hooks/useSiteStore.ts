import { create } from "zustand";

type NoteFilter = "全部" | "开发" | "随笔" | "收藏";

type SiteStore = {
  mobileMenuOpen: boolean;
  noteFilter: NoteFilter;
  setNoteFilter: (filter: NoteFilter) => void;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
};

export const useSiteStore = create<SiteStore>((set) => ({
  mobileMenuOpen: false,
  noteFilter: "全部",
  setNoteFilter: (noteFilter) => set({ noteFilter }),
  toggleMobileMenu: () =>
    set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),
  closeMobileMenu: () => set({ mobileMenuOpen: false }),
}));
