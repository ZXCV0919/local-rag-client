import { create } from 'zustand';
import type { Document, ImportProgress } from '../types/document';

interface DocumentState {
  documents: Document[];
  currentDocumentId: string | null;
  importProgress: Map<string, ImportProgress>;
  loading: boolean;
  error: string | null;
  setDocuments: (docs: Document[]) => void;
  addDocument: (doc: Document) => void;
  updateDocument: (id: string, updates: Partial<Document>) => void;
  removeDocument: (id: string) => void;
  setImportProgress: (id: string, progress: ImportProgress) => void;
  removeImportProgress: (id: string) => void;
  setCurrentDocumentId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  currentDocumentId: null,
  importProgress: new Map(),
  loading: false,
  error: null,
  setDocuments: (docs) => set({ documents: docs }),
  addDocument: (doc) => set((state) => ({ documents: [...state.documents, doc] })),
  updateDocument: (id, updates) =>
    set((state) => ({
      documents: state.documents.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    })),
  removeDocument: (id) =>
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== id),
      currentDocumentId: state.currentDocumentId === id ? null : state.currentDocumentId,
    })),
  setImportProgress: (id, progress) =>
    set((state) => {
      const next = new Map(state.importProgress);
      next.set(id, progress);
      return { importProgress: next };
    }),
  removeImportProgress: (id) =>
    set((state) => {
      const next = new Map(state.importProgress);
      next.delete(id);
      return { importProgress: next };
    }),
  setCurrentDocumentId: (id) => set({ currentDocumentId: id }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
