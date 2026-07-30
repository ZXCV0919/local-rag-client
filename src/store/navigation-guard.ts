import { create } from 'zustand';
import type { NavigateOptions } from 'react-router-dom';

export interface PendingNavigation {
  to: string;
  options?: NavigateOptions;
}

interface NavigationGuardState {
  open: boolean;
  pending: PendingNavigation | null;
  /** 在用户确认前先暂存跳转（例如在生成回答时切换页面）。 */
  openForNavigation: (to: string, options?: NavigateOptions) => void;
  close: () => void;
}

export const useNavigationGuardStore = create<NavigationGuardState>((set) => ({
  open: false,
  pending: null,
  openForNavigation: (to, options) => set({ open: true, pending: { to, options } }),
  close: () => set({ open: false, pending: null }),
}));
