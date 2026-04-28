import { create } from 'zustand';

export type WorldId = 'batman' | 'wakanda' | 'jarvis' | 'oracle';

interface OracleStore {
  currentWorld: WorldId | null;
  setWorld: (world: WorldId) => void;
  clearWorld: () => void;
}

export const useOracleStore = create<OracleStore>((set) => ({
  currentWorld: null,
  setWorld: (world: WorldId) => set({ currentWorld: world }),
  clearWorld: () => set({ currentWorld: null }),
}));
