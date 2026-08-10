import { useCallback } from 'react';
import { tauriCommand } from './useDatabase';
import { useDocumentStore } from '../store/document';
import { invalidateSourcePreviewMemoryEntry } from '../services/document/source-preview';
import type { Document, ImportProgress } from '../types/document';

export function useDocument(kbId: string | undefined) {
  const loadDocuments = useCallback(async () => {
    if (!kbId) return;
    const { setLoading, setError, setDocuments } = useDocumentStore.getState();
    setLoading(true);
    setError(null);
    try {
      const docs = await tauriCommand<Document[]>('list_documents', { kbId });
      setDocuments(docs);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [kbId]);

  const importDocument = useCallback(
    async (
      filePath: string,
      fileName: string,
      fileType: string,
      fileSize: number,
      contentHash: string,
    ) => {
      if (!kbId) throw new Error('Missing knowledge base');
      const { addDocument } = useDocumentStore.getState();
      const doc = await tauriCommand<Document>('import_document', {
        kbId,
        filePath,
        fileName,
        fileType,
        fileSize,
        contentHash,
      });
      addDocument(doc);
      return doc;
    },
    [kbId],
  );

  const deleteDocument = useCallback(async (id: string) => {
    const { removeDocument } = useDocumentStore.getState();
    await tauriCommand<void>('delete_document', { id });
    invalidateSourcePreviewMemoryEntry(id);
    removeDocument(id);
  }, []);

  const updateDocumentStatus = useCallback(
    async (id: string, status: Document['status'], errorMessage?: string) => {
      const { updateDocument } = useDocumentStore.getState();
      const updated = await tauriCommand<Document>('update_document_status', {
        id,
        status,
        errorMessage: errorMessage ?? null,
      });
      updateDocument(id, updated);
      return updated;
    },
    [],
  );

  const documents = useDocumentStore((s) => s.documents);
  const currentDocumentId = useDocumentStore((s) => s.currentDocumentId);
  const importProgress = useDocumentStore((s) => s.importProgress);
  const loading = useDocumentStore((s) => s.loading);
  const error = useDocumentStore((s) => s.error);
  const setCurrentDocumentId = useDocumentStore((s) => s.setCurrentDocumentId);
  const setImportProgress = useDocumentStore((s) => s.setImportProgress);
  const removeImportProgress = useDocumentStore((s) => s.removeImportProgress);

  return {
    documents,
    currentDocumentId,
    importProgress,
    loading,
    error,
    setCurrentDocumentId,
    setImportProgress,
    removeImportProgress,
    loadDocuments,
    importDocument,
    deleteDocument,
    updateDocumentStatus,
  };
}

export type { ImportProgress };
