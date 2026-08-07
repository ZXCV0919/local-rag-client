import { useCallback, useEffect, useRef, useState } from 'react';

import { useParams, useLocation } from 'react-router-dom';

import { useKbChatWorkbench } from '../../context/KbChatWorkbenchContext';

import { tauriCommand } from '../../hooks/useDatabase';

import { abortChatGeneration, clearChatAbortIf, setChatAbortController } from '../../services/chat-generation';

import { chat } from '../../services/llm';

import { useChatStore } from '../../store/chat';

import { useSettingsStore } from '../../store/settings';

import type { Conversation, Message } from '../../types/conversation';

import { DEFAULT_SETTINGS } from '../../types/settings';

import { estimateTokenCount } from '../../utils/token-counter';

import { ChatHeader } from './ChatHeader';

import { ComposerBar } from './ComposerBar';

import { MessageList } from './MessageList';



function parseStoredString(raw: string | undefined, fallback: string): string {

  if (raw == null || raw === '') return fallback;

  try {

    return JSON.parse(raw) as string;

  } catch {

    return raw;

  }

}



function messagesToLlmHistory(rows: Message[]): Array<{ role: 'user' | 'assistant'; content: string }> {

  return rows

    .filter((m) => m.role === 'user' || m.role === 'assistant')

    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

}



export function ChatInterface() {

  const { id: kbId, conversationId } = useParams<{ id: string; conversationId: string }>();

  const location = useLocation();

  const {

    kb,

    retrievalMode,

    ollamaUrl,

    vectorWeight,

    keywordWeight,

    maxResults,

    onConversationsNeedRefresh,

  } = useKbChatWorkbench();



  const setMessages = useChatStore((s) => s.setMessages);

  const setStreamingMessage = useChatStore((s) => s.setStreamingMessage);

  const appendStreamingMessage = useChatStore((s) => s.appendStreamingMessage);

  const streamingMessage = useChatStore((s) => s.streamingMessage);

  const pipelineRunning = useChatStore((s) => s.pipelineRunning);

  const retrieving = useChatStore((s) => s.retrieving);

  const pendingLlm = useChatStore((s) => s.pendingLlm);

  const streamingRefs = useChatStore((s) => s.streamingRefs);

  const setError = useChatStore((s) => s.setError);

  const setChatRetrieving = useChatStore((s) => s.setChatRetrieving);

  const setChatPendingLlm = useChatStore((s) => s.setChatPendingLlm);

  const setStreamingRefs = useChatStore((s) => s.setStreamingRefs);

  const startChatPipelineScope = useChatStore((s) => s.startChatPipelineScope);

  const resetStreamingUi = useChatStore((s) => s.resetStreamingUi);



  const settings = useSettingsStore((s) => s.settings);
  const answerSelfCheck = settings.answer_self_check;

  const messages = useChatStore((s) => s.messages);



  const [chatModel, setChatModel] = useState(DEFAULT_SETTINGS.default_chat_model);

  const [embeddingModel, setEmbeddingModel] = useState(DEFAULT_SETTINGS.default_embedding_model);

  const [lastUserQuery, setLastUserQuery] = useState('');

  const [inputPrefill, setInputPrefill] = useState<string | null>(null);



  const convTitleRef = useRef<string | null>(null);

  const prevConversationIdRef = useRef<string | undefined>(undefined);



  useEffect(() => {

    const state = location.state as { prefill?: string } | null;

    if (state?.prefill?.trim()) {

      setInputPrefill(state.prefill.trim());

    } else if (prevConversationIdRef.current !== conversationId) {

      setInputPrefill(null);

    }

  }, [conversationId, location.state]);



  const loadMessages = useCallback(

    async (cid: string) => {

      try {

        const rows = await tauriCommand<Message[]>('list_messages', { conversationId: cid });

        setMessages(rows);

      } catch (e) {

        setError(e instanceof Error ? e.message : String(e));

        setMessages([]);

      }

    },

    [setMessages, setError],

  );



  useEffect(() => {

    if (!conversationId) return;

    const prev = prevConversationIdRef.current;

    prevConversationIdRef.current = conversationId;

    const st = useChatStore.getState();

    if (

      prev &&

      prev !== conversationId &&

      st.pipelineRunning &&

      st.streamingConversationId === prev

    ) {

      abortChatGeneration();

      st.resetStreamingUi();

    }



    let cancelled = false;

    (async () => {

      try {

        const detail = await tauriCommand<{ conversation: Conversation; messages: Message[] }>(

          'get_conversation',

          { id: conversationId },

        );

        if (cancelled) return;

        convTitleRef.current = detail.conversation.title;

        setChatModel(detail.conversation.llm_model || DEFAULT_SETTINGS.default_chat_model);

        setMessages(detail.messages);

      } catch {

        if (!cancelled) void loadMessages(conversationId);

      }

    })();

    return () => {

      cancelled = true;

    };

  }, [conversationId, loadMessages, setMessages]);



  useEffect(() => {

    let cancelled = false;

    (async () => {

      try {

        const all = await tauriCommand<Record<string, string>>('get_all_settings');

        if (cancelled) return;

        setEmbeddingModel(

          parseStoredString(all.default_embedding_model, DEFAULT_SETTINGS.default_embedding_model),

        );

      } catch {

        /* defaults */

      }

    })();

    return () => {

      cancelled = true;

    };

  }, []);



  const handleStop = useCallback(() => {

    abortChatGeneration();

    resetStreamingUi();

  }, [resetStreamingUi]);



  useEffect(() => {

    const onKeyDown = (e: KeyboardEvent) => {

      if (e.key !== 'Escape') return;

      if (!pipelineRunning) return;

      const t = e.target as HTMLElement | null;

      const tag = t?.tagName?.toUpperCase?.() ?? '';

      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      abortChatGeneration();

      resetStreamingUi();

    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);

  }, [pipelineRunning, resetStreamingUi]);



  const handleSend = useCallback(

    async (text: string, mode: typeof retrievalMode) => {

      if (!conversationId || !kbId || !kb) return;



      setError(null);

      setLastUserQuery(text);



      abortChatGeneration();

      startChatPipelineScope(kbId, conversationId);

      try {

        await tauriCommand<Message>('add_message', {

          conversationId,

          role: 'user',

          content: text,

          referencedChunks: '[]',

          tokenCount: estimateTokenCount(text),

        });

        await loadMessages(conversationId);

      } catch (e) {

        setError(e instanceof Error ? e.message : String(e));

        abortChatGeneration();

        resetStreamingUi();

        return;

      }



      const conversationHistory = messagesToLlmHistory(useChatStore.getState().messages);



      setChatRetrieving(false);

      setChatPendingLlm(false);

      setStreamingMessage(null);

      setStreamingRefs([]);



      abortChatGeneration();

      const controller = new AbortController();

      setChatAbortController(controller);



      const st = useSettingsStore.getState().settings;

      const stream = chat({

        kbId,

        query: text,

        model: chatModel,

        embeddingModel: kb.embedding_model || embeddingModel,

        ollamaUrl,

        retrievalMode: mode,

        rerankMode: st.rerank_mode,

        vectorWeight,

        keywordWeight,

        maxResults,

        conversationHistory,

        signal: controller.signal,

        answerSelfCheck,

        chatProvider: st.chat_provider,

        siliconflowApiKey: st.siliconflow_api_key,

        siliconflowBaseUrl: st.siliconflow_base_url,

        siliconflowChatModel: st.siliconflow_chat_model,

      });



      let refs: string[] = [];

      let hadError = false;



      try {

        for await (const chunk of stream) {

          if (chunk.type === 'status') {

            setChatRetrieving(true);

          } else if (chunk.type === 'meta') {

            refs = chunk.references.map((r) => r.chunk_id);

            setStreamingRefs(refs);

            setChatRetrieving(false);

            setChatPendingLlm(true);

            setStreamingMessage('');

          } else if (chunk.type === 'content' && chunk.content) {

            setChatPendingLlm(false);

            appendStreamingMessage(chunk.content);

          } else if (chunk.type === 'error') {

            hadError = true;

            setError(chunk.error ?? 'Unknown error');

            setChatPendingLlm(false);

            setChatRetrieving(false);

          } else if (chunk.type === 'done') {

            setChatPendingLlm(false);

            setChatRetrieving(false);

          }

        }



        const bodyFromStore = useChatStore.getState().streamingMessage ?? '';

        const shouldPersist =

          !controller.signal.aborted && !hadError && bodyFromStore.trim().length > 0;



        if (shouldPersist) {

          await tauriCommand<Message>('add_message', {

            conversationId,

            role: 'assistant',

            content: bodyFromStore,

            referencedChunks: JSON.stringify(refs),

            tokenCount: estimateTokenCount(bodyFromStore),

          });



          const title = convTitleRef.current;

          if (title === '新对话' || title === '') {

            const shortTitle = text.trim().slice(0, 20) + (text.trim().length > 20 ? '…' : '');

            await tauriCommand<Conversation>('update_conversation_title', {

              id: conversationId,

              title: shortTitle,

            });

            convTitleRef.current = shortTitle;

          }



          await loadMessages(conversationId);

          onConversationsNeedRefresh();

        }

      } catch (e) {

        if (!(e instanceof DOMException && e.name === 'AbortError')) {

          setError(e instanceof Error ? e.message : String(e));

        }

      } finally {

        clearChatAbortIf(controller);

        resetStreamingUi();

      }

    },

    [

      conversationId,

      kbId,

      kb,

      chatModel,

      embeddingModel,

      ollamaUrl,

      vectorWeight,

      keywordWeight,

      maxResults,

      loadMessages,

      setError,

      setStreamingMessage,

      appendStreamingMessage,

      onConversationsNeedRefresh,

      answerSelfCheck,

      startChatPipelineScope,

      setChatRetrieving,

      setChatPendingLlm,

      setStreamingRefs,

      resetStreamingUi,

    ],

  );



  if (!conversationId || !kbId) {

    return null;

  }



  const streamingBody = streamingMessage;

  const showDraft = retrieving || pendingLlm || streamingBody !== null;

  const chatError = useChatStore((s) => s.error);

  const showEmpty = messages.length === 0 && !showDraft;

  const headerModel =
    settings.chat_provider === 'siliconflow'
      ? settings.siliconflow_chat_model.length > 48
        ? `${settings.siliconflow_chat_model.slice(0, 45)}…`
        : settings.siliconflow_chat_model
      : chatModel;



  return (

    <div className="mx-auto flex h-full min-h-0 w-full max-w-[760px] flex-1 flex-col overflow-hidden px-4 pb-3 pt-2">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-float)]">
        <div className="flex w-full min-w-0 shrink-0 flex-col border-b border-[var(--color-border)] px-5 pt-4">
          {kb ? (
            <ChatHeader
              kbName={kb.name}
              model={headerModel}
              retrievalMode={retrievalMode}
              chatProvider={settings.chat_provider}
            />
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5">
          <div className="flex w-full min-w-0 min-h-0 flex-1 flex-col">
            {chatError ? (
              <div className="mb-2 mt-3 shrink-0 rounded-[length:var(--radius-control)] border border-[var(--color-danger-border)] bg-[var(--badge-error-bg)] px-3 py-2 text-xs text-[var(--badge-error-fg)]">
                {chatError}
              </div>
            ) : null}
            <MessageList
              conversationId={conversationId}
              messages={messages}
              retrieving={retrieving}
              pendingLlm={pendingLlm}
              streamingBody={showDraft ? (streamingBody ?? '') : null}
              streamingReferencedChunkIds={streamingRefs}
              highlightQuery={lastUserQuery}
            />
          </div>
        </div>

        <ComposerBar
          disabled={!kb}
          streaming={pipelineRunning}
          showSuggestions={showEmpty}
          prefill={inputPrefill}
          onSend={handleSend}
          onStop={handleStop}
        />
      </div>
    </div>

  );

}

