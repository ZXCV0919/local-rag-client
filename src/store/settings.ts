import { create } from 'zustand';
import { DEFAULT_SETTINGS, type AppSettings } from '../types/settings';

interface SettingsState {
  settings: AppSettings;
  loading: boolean;
  error: string | null;
  setSettings: (settings: Partial<AppSettings>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: { ...DEFAULT_SETTINGS },
  loading: false,
  error: null,
  setSettings: (updates) =>
    set((state) => ({ settings: { ...state.settings, ...updates } })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
