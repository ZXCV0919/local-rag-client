import { listen } from '@tauri-apps/api/event';
import type { ImportProgress } from '../../types/document';

/** Subscribe to import progress (optional; importer also updates Zustand directly). */
export function listenToImportProgress(
  documentId: string,
  callback: (progress: ImportProgress) => void,
): Promise<() => void> {
  return listen<ImportProgress>(`document:${documentId}:progress`, (event) => {
    callback(event.payload);
  });
}
