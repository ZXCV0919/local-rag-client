import { useCallback, useState } from 'react';

export const SOURCES_PANEL_STORAGE_KEY = 'ui.sourcesPanelOpen';

export function readStoredOpen(): boolean {
  try {
    return localStorage.getItem(SOURCES_PANEL_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeStoredOpen(open: boolean): void {
  try {
    localStorage.setItem(SOURCES_PANEL_STORAGE_KEY, open ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

export function useSourcesPanel(): {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
} {
  const [open, setOpenState] = useState(readStoredOpen);
  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    writeStoredOpen(next);
  }, []);
  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);
  return { open, setOpen, toggle };
}
