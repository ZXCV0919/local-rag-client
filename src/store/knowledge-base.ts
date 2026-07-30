import { create } from 'zustand';
import type { KnowledgeBase } from '../types/knowledge-base';

interface KnowledgeBaseState {
  knowledgeBases: KnowledgeBase[];
  currentId: string | null;
  loading: boolean;
  error: string | null;
  setKnowledgeBases: (kbs: KnowledgeBase[]) => void;
  setCurrentId: (id: string | null) => void;
  addKnowledgeBase: (kb: KnowledgeBase) => void;
  updateKnowledgeBase: (id: string, updates: Partial<KnowledgeBase>) => void;
  removeKnowledgeBase: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useKnowledgeBaseStore = create<KnowledgeBaseState>((set) => ({
  knowledgeBases: [],
  currentId: null,
  loading: false,
  error: null,
  setKnowledgeBases: (kbs) => set({ knowledgeBases: kbs }),
  setCurrentId: (id) => set({ currentId: id }),
  addKnowledgeBase: (kb) => set((state) => ({ knowledgeBases: [...state.knowledgeBases, kb] })),
  updateKnowledgeBase: (id, updates) =>
    set((state) => ({
      knowledgeBases: state.knowledgeBases.map((k) =>
        k.id === id ? { ...k, ...updates } : k,
      ),
    })),
  removeKnowledgeBase: (id) =>
    set((state) => ({
      knowledgeBases: state.knowledgeBases.filter((k) => k.id !== id),
      currentId: state.currentId === id ? null : state.currentId,
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
