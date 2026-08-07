import { useCallback, useState } from 'react';

export const SOURCES_PANEL_STORAGE_KEY = 'ui.sourcesPanelOpen';

export type SourcesFocusChunk = {
  documentId: string;
  chunkId: string;
  nonce: number;
};

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

export function nextFocusChunk(
  prev: SourcesFocusChunk | null,
  target: { documentId: string; chunkId: string },
): SourcesFocusChunk {
  return {
    documentId: target.documentId,
    chunkId: target.chunkId,
    nonce: (prev?.nonce ?? 0) + 1,
  };
}

export function useSourcesPanel(): {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  focusChunk: SourcesFocusChunk | null;
  revealChunk: (target: { documentId: string; chunkId: string }) => void;
} {
  const [open, setOpenState] = useState(readStoredOpen);
  const [focusChunk, setFocusChunk] = useState<SourcesFocusChunk | null>(null);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    writeStoredOpen(next);
  }, []);

  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);

  const revealChunk = useCallback(
    (target: { documentId: string; chunkId: string }) => {
      setOpen(true);
      setFocusChunk((prev) => nextFocusChunk(prev, target));
    },
    [setOpen],
  );

  return { open, setOpen, toggle, focusChunk, revealChunk };
}
