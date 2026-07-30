import { create } from 'zustand';
import type { Conversation, Message } from '../types/conversation';

interface ChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Message[];
  streamingMessage: string | null;
  loading: boolean;
  error: string | null;

  pipelineRunning: boolean;
  retrieving: boolean;
  pendingLlm: boolean;
  streamingRefs: string[];
  streamingConversationId: string | null;
  streamingKbId: string | null;

  setConversations: (convs: Conversation[]) => void;
  addConversation: (conv: Conversation) => void;
  removeConversation: (id: string) => void;
  updateConversationTitle: (id: string, title: string) => void;
  setCurrentConversationId: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setStreamingMessage: (content: string | null) => void;
  appendStreamingMessage: (chunk: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  setPipelineRunning: (v: boolean) => void;
  setChatRetrieving: (v: boolean) => void;
  setChatPendingLlm: (v: boolean) => void;
  setStreamingRefs: (ids: string[]) => void;
  startChatPipelineScope: (kbId: string, conversationId: string) => void;
  resetStreamingUi: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  streamingMessage: null,
  loading: false,
  error: null,

  pipelineRunning: false,
  retrieving: false,
  pendingLlm: false,
  streamingRefs: [],
  streamingConversationId: null,
  streamingKbId: null,

  setConversations: (convs) => set({ conversations: convs }),
  addConversation: (conv) => set((state) => ({ conversations: [conv, ...state.conversations] })),
  removeConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      currentConversationId: state.currentConversationId === id ? null : state.currentConversationId,
    })),
  updateConversationTitle: (id, title) =>
    set((state) => ({
      conversations: state.conversations.map((c) => (c.id === id ? { ...c, title } : c)),
    })),
  setCurrentConversationId: (id) => set({ currentConversationId: id }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setStreamingMessage: (content) => set({ streamingMessage: content }),
  appendStreamingMessage: (chunk) =>
    set((state) => ({
      streamingMessage: (state.streamingMessage || '') + chunk,
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  setPipelineRunning: (pipelineRunning) => set({ pipelineRunning }),
  setChatRetrieving: (retrieving) => set({ retrieving }),
  setChatPendingLlm: (pendingLlm) => set({ pendingLlm }),
  setStreamingRefs: (streamingRefs) => set({ streamingRefs }),
  startChatPipelineScope: (streamingKbId, streamingConversationId) =>
    set({
      pipelineRunning: true,
      streamingKbId,
      streamingConversationId,
      retrieving: false,
      pendingLlm: false,
      streamingRefs: [],
      streamingMessage: null,
    }),
  resetStreamingUi: () =>
    set({
      streamingMessage: null,
      retrieving: false,
      pendingLlm: false,
      pipelineRunning: false,
      streamingRefs: [],
      streamingConversationId: null,
      streamingKbId: null,
    }),
}));
