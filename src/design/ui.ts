import { create } from "zustand";

/** Reiner Oberflächenzustand: welche Player-Ansichten gerade offen sind. */
interface UiState {
  queueOpen: boolean;
  fullOpen: boolean;
  toggleQueue: () => void;
  setQueue: (open: boolean) => void;
  setFull: (open: boolean) => void;
}

export const useUi = create<UiState>((set) => ({
  queueOpen: false,
  fullOpen: false,
  toggleQueue: () => set((s) => ({ queueOpen: !s.queueOpen })),
  setQueue: (queueOpen) => set({ queueOpen }),
  setFull: (fullOpen) => set({ fullOpen }),
}));
