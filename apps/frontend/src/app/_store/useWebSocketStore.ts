import { create } from 'zustand';
import { persist, createJSONStorage, subscribeWithSelector } from 'zustand/middleware';
import { toast } from 'sonner';
import axios from 'axios';
import { StreamingMessage } from '@/types/chat';
import { API_V1_BASE_URL, getAgentsWebSocketUrl } from '@/lib/api';

const cleanErrorMessage = (errorMsg: string) => {
  if (typeof errorMsg === 'string' && errorMsg.includes("{'error':")) {
    try {
      const parts = errorMsg.split(" - {'error':");
      if (parts.length === 2) {
        const mainMsg = parts[0];
        const innerMsgMatch = parts[1].match(/'message':\s*'([^']+)'/);
        const innerMsg = innerMsgMatch ? innerMsgMatch[1] : '';
        if (innerMsg) {
          return `${mainMsg} - ${innerMsg}`;
        }
        return mainMsg;
      }
    } catch (e) {
      console.error("Error parsing error message:", e);
    }
  }
  return errorMsg;
};

const TOOL_DATA_PREFIX_REGEX = /^ToolData:\s*/i;

const normalizeToolChunk = (raw: unknown): string => {
  if (raw === null || raw === undefined) return '';

  let value: unknown = raw;
  if (typeof value === 'string') {
    value = value.replace(TOOL_DATA_PREFIX_REGEX, '').trim();
  }

  if (value && typeof value === 'object') {
    const maybeEnvelope = value as { type?: string; content?: unknown };
    if (maybeEnvelope.type === 'tool' && maybeEnvelope.content !== undefined) {
      value = maybeEnvelope.content;
    }
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(TOOL_DATA_PREFIX_REGEX, '').trim();
    if (!cleaned) return '';
    try {
      return JSON.stringify(JSON.parse(cleaned));
    } catch {
      return cleaned;
    }
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const normalizeStreamText = (raw: unknown): string => {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'string') return raw;
  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw);
  }
};

const normalizeAgentDisplayName = (name?: string): string => {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'Assistant';
  const lower = trimmed.toLowerCase();
  if (lower === 'tool' || lower === 'tools' || lower === 'tool_result') {
    return 'Assistant';
  }
  return trimmed;
};

type ChatHistoryItem = {
  id: string;
  name: string;
  thread_id: string;
  agents: string[];
  org_id?: string | null;
}

type ChatHistoryResponse = {
  chats: ChatHistoryItem[];
  has_more: boolean;
}

export type ChatHistoryVisibilityMode = 'current_org' | 'all';

const CHAT_HISTORY_PAGE_SIZE = 15;
const CHAT_HISTORY_CACHE_MAX_ITEMS = 100;
const CHAT_HISTORY_TTL_MS = 60 * 1000;

const buildChatHistoryScopeKey = (
  mode: ChatHistoryVisibilityMode,
  organizationId: string | null
): string => {
  if (mode === 'all') return 'all';
  if (organizationId) return `org:${organizationId}`;
  return 'personal';
};

const buildChatHistoryParams = (
  mode: ChatHistoryVisibilityMode,
  organizationId: string | null,
  offset: number
) => {
  if (mode === 'all') {
    return {
      limit: CHAT_HISTORY_PAGE_SIZE,
      offset,
      scope: 'all',
      organization_id: organizationId || undefined,
    };
  }

  if (organizationId) {
    return {
      limit: CHAT_HISTORY_PAGE_SIZE,
      offset,
      scope: 'org',
      is_org: true,
      organization_id: organizationId,
    };
  }

  return {
    limit: CHAT_HISTORY_PAGE_SIZE,
    offset,
    scope: 'personal',
    is_org: false,
    organization_id: undefined,
  };
};

interface WSMessage {
  type: string;
  message: string;
  model?: string;
  agents?: any[];
  image_urls?: string[];
  file_urls?: string[];
  organization_id?: string;
  is_org?: boolean;
  chat_id?: string;
}

interface WebSocketState {
  ws: WebSocket | null;
  isConnected: boolean;
  lastSentMessage: any | null;
  lastSentModel?: string | null;
  lastReceivedMessage: any;
  finalStructuredMessages: StreamingMessage[];
  lastToolCalls: any[] | null;
  isStreaming: boolean;
  reconnectTimeout: NodeJS.Timeout | null;
  lastSentSource: string | null;
  currentRequestId: string | null;
  currentChatId: string | null;
  currentToolName: string | null;
  currentToolData: string | null;
  chatMessages: StreamingMessage[];
  streamingContent: Record<string, string>; 
  chatHistory: ChatHistoryItem[]; 
  isHistoryLoading: boolean;
  isHistoryLoadingMore: boolean;
  chatHistoryHasMore: boolean;
  chatHistoryScope: string | null;
  chatHistoryVisibilityMode: ChatHistoryVisibilityMode;
  chatHistoryLastSyncedAt: number;
  hasHydrated: boolean;

  setChatHistoryVisibilityMode: (mode: ChatHistoryVisibilityMode) => void;
  fetchChatHistory: (
    token: string,
    force?: boolean,
    organizationId?: string | null,
    mode?: ChatHistoryVisibilityMode
  ) => Promise<void>;
  loadMoreChatHistory: (
    token: string,
    organizationId?: string | null,
    mode?: ChatHistoryVisibilityMode
  ) => Promise<void>;
  prependChatHistoryItem: (
    chat: ChatHistoryItem,
    organizationId?: string | null,
    mode?: ChatHistoryVisibilityMode
  ) => void;
  removeChatHistoryItem: (chatId: string) => void;
  markChatHistoryStale: (organizationId?: string | null, mode?: ChatHistoryVisibilityMode) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  appendMessage: (message: StreamingMessage | StreamingMessage[]) => void;
  connect: (token: string) => void;
  disconnect: () => void;
  sendMessage: (message: WSMessage, source?: string) => void;
  setLastSentMessage: (msg: string | null, source: string | null, model?: string | null) => void;
  clearLastSentMessage: () => void;
  setLastSentSource: (source: string | null) => void;
  clearLastSentSource: () => void;
  stopGeneration: () => void;
}

const useWebSocketStore = create<WebSocketState>()(
  persist(
    subscribeWithSelector((set, get) => ({
    ws: null,
    isConnected: false,
    lastSentMessage: null,
    lastSentModel: null,
    lastReceivedMessage: null,
    finalStructuredMessages: [],
    lastToolCalls: null,
    isStreaming: false,
    reconnectTimeout: null,
    lastSentSource: null,
    currentRequestId: null,
    currentChatId: null,
    currentToolName: null,
    currentToolData: null,
    chatMessages: [],
    streamingContent: {},
    chatHistory: [], 
    isHistoryLoading: false,
    isHistoryLoadingMore: false,
    chatHistoryHasMore: true,
    chatHistoryScope: null,
    chatHistoryVisibilityMode: 'current_org',
    chatHistoryLastSyncedAt: 0,
    hasHydrated: false,

    setLastSentMessage: (msg, source, model) =>
      set({ lastSentMessage: msg, lastSentSource: source, lastSentModel: model || null }),

    setHasHydrated: (hasHydrated) => set({ hasHydrated }),

    setChatHistoryVisibilityMode: (mode) => {
      set((state) => {
        if (state.chatHistoryVisibilityMode === mode) return state;
        return {
          chatHistoryVisibilityMode: mode,
          chatHistory: [],
          chatHistoryHasMore: true,
          chatHistoryScope: null,
          chatHistoryLastSyncedAt: 0,
        };
      });
    },

    fetchChatHistory: async (
      token: string,
      force = false,
      organizationId: string | null = null,
      mode: ChatHistoryVisibilityMode = 'current_org'
    ) => {
        const state = get();
        const nextScope = buildChatHistoryScopeKey(mode, organizationId);
        const currentScope = state.chatHistoryScope;
        const scopeChanged = currentScope !== nextScope;
        const hasScopedCache = !scopeChanged && state.chatHistory.length > 0;
        const isCacheFresh =
            hasScopedCache &&
            state.chatHistoryLastSyncedAt > 0 &&
            Date.now() - state.chatHistoryLastSyncedAt < CHAT_HISTORY_TTL_MS;
        if (
            state.isHistoryLoading ||
            state.isHistoryLoadingMore ||
            (!force && isCacheFresh)
        ) {
            return;
        }

        const isBackgroundRefresh = !force && hasScopedCache;
        set({
            isHistoryLoading: !isBackgroundRefresh,
            ...(scopeChanged || force
                ? { chatHistory: [], chatHistoryHasMore: true, chatHistoryLastSyncedAt: 0 }
                : {})
        });
        
        try {
            const response = await axios.get<ChatHistoryResponse>(`${API_V1_BASE_URL}/agents/chats`, {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                params: buildChatHistoryParams(mode, organizationId, 0),
            });
            set({ 
                chatHistory: response.data.chats || [],
                chatHistoryHasMore: response.data.has_more ?? false,
                chatHistoryScope: nextScope,
                chatHistoryVisibilityMode: mode,
                chatHistoryLastSyncedAt: Date.now(),
                isHistoryLoading: false 
            });
            console.log('Chat history loaded into store:', response.data);
        } catch (error) {
            console.error("Failed to fetch chat history:", error);
            set({ isHistoryLoading: false });
        }
    },

    loadMoreChatHistory: async (
      token: string,
      organizationId: string | null = null,
      mode: ChatHistoryVisibilityMode = 'current_org'
    ) => {
        const state = get();
        const nextScope = buildChatHistoryScopeKey(mode, organizationId);
        if (
            state.isHistoryLoading ||
            state.isHistoryLoadingMore ||
            !state.chatHistoryHasMore ||
            state.chatHistoryScope !== nextScope
        ) {
            return;
        }

        set({ isHistoryLoadingMore: true });
        try {
            const response = await axios.get<ChatHistoryResponse>(`${API_V1_BASE_URL}/agents/chats`, {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                params: buildChatHistoryParams(mode, organizationId, state.chatHistory.length),
            });

            set((prev) => {
                const existingIds = new Set(prev.chatHistory.map((chat) => chat.id));
                const incomingChats = (response.data.chats || []).filter(
                    (chat) => !existingIds.has(chat.id)
                );
                return {
                    chatHistory: [...prev.chatHistory, ...incomingChats],
                    chatHistoryHasMore: response.data.has_more ?? false,
                    chatHistoryVisibilityMode: mode,
                    chatHistoryLastSyncedAt: Date.now(),
                    isHistoryLoadingMore: false,
                };
            });
        } catch (error) {
            console.error("Failed to load more chat history:", error);
            set({ isHistoryLoadingMore: false });
        }
    },

    prependChatHistoryItem: (
      chat: ChatHistoryItem,
      organizationId: string | null = null,
      mode: ChatHistoryVisibilityMode = 'current_org'
    ) => {
        const nextScope = buildChatHistoryScopeKey(mode, organizationId);
        set((state) => {
            const sameScope = state.chatHistoryScope === nextScope;
            const scopeHistory = sameScope ? state.chatHistory : [];
            const deduped = scopeHistory.filter((item) => item.id !== chat.id);
            return {
                chatHistory: [chat, ...deduped].slice(0, CHAT_HISTORY_CACHE_MAX_ITEMS),
                chatHistoryScope: nextScope,
                chatHistoryVisibilityMode: mode,
                chatHistoryLastSyncedAt: 0,
            };
        });
    },

    removeChatHistoryItem: (chatId: string) =>
      set((state) => ({
          chatHistory: state.chatHistory.filter((chat) => chat.id !== chatId),
          chatHistoryLastSyncedAt: 0,
      })),

    markChatHistoryStale: (
      organizationId: string | null = null,
      mode: ChatHistoryVisibilityMode = 'current_org'
    ) => {
      const nextScope = buildChatHistoryScopeKey(mode, organizationId);
      if (get().chatHistoryScope !== nextScope) return;
      set({ chatHistoryLastSyncedAt: 0 });
    },

    clearLastSentMessage: () =>
      set({ lastSentMessage: null, lastSentSource: null, lastSentModel: null }),

    setLastSentSource: (source) =>
      set({ lastSentSource: source }),

    clearLastSentSource: () =>
      set({ lastSentSource: null }),

    stopGeneration: () => {
      const { ws, currentRequestId } = get();
      if (ws && ws.readyState === WebSocket.OPEN && currentRequestId) {
        // Optional: Send a stop signal to the server if supported
      }
      
      set((state) => {
        const messages = [...state.chatMessages];
        const lastAiIndex = messages.findLastIndex(m => m.sender === 'ai' && m.isStreaming);
        
        if (lastAiIndex >= 0) {
          messages[lastAiIndex] = {
            ...messages[lastAiIndex],
            text: (messages[lastAiIndex].text || "") + "\n\nWe had to Pause the Response",
            isStreaming: false
          };
        }
        
        return { 
            isStreaming: false, 
            currentRequestId: null,
            chatMessages: messages
        };
      });
    },

    appendMessage: (newMessages) => 
        set((state) => ({ 
            chatMessages: [
                ...state.chatMessages, 
                ...(Array.isArray(newMessages) ? newMessages : [newMessages])
            ] 
        })),
    
    connect: (token) => {
      if (get().ws && get().isConnected) {
        console.log("WebSocket already connected.");
        return;
      }

      console.log("Connecting WebSocket…");
      const wsUrl = getAgentsWebSocketUrl();
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("WebSocket opened");
        ws.send(JSON.stringify({ type: 'auth', token }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          set({ lastReceivedMessage: message });

          // Support both message.event and message.type for backward compat
          const eventName = message.event || message.type;

          if (eventName === 'connection_success') {
            console.log("WebSocket connected:", message.user_id);
            set({ isConnected: true });
          }

          else if (eventName === 'request_submitted') {
            console.log("Request submitted:", message.request_id);
            set({ isStreaming: true, currentRequestId: message.request_id });
          }

          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          // STREAM CHUNK — routed via switch(chunk_type)
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          else if (eventName === 'stream_chunk' || eventName === 'chunk') {
            console.log("Stream chunk received:", message);
            const { request_id, content, is_final, chat_id, agent_name, tool_name, chunk_type, tool_output, tool_args } = message;
            const safeContent = normalizeStreamText(content);

            // Ignore chunks from a different/cancelled request
            if (get().currentRequestId !== request_id) {
              return;
            }

            // Capture real chat_id
            if (chat_id && get().currentChatId !== chat_id) {
              set({ currentChatId: chat_id });
            }

            const effectiveChunkType = chunk_type || 'text';

            switch (effectiveChunkType) {

              // ── summarize lifecycle ─────────────────────────────────────
              case 'summarize_start': {
                set((state) => {
                  const msgs = [...state.chatMessages];
                  const lastAiIdx = msgs.findLastIndex(m => m.sender === 'ai' && m.isStreaming);
                  if (lastAiIdx >= 0) {
                    msgs[lastAiIdx] = { ...msgs[lastAiIdx], systemStatus: 'Summarizing chat history...' };
                  } else {
                    msgs.push({
                      sender: 'ai',
                      text: '',
                      isStreaming: true,
                      toolCalls: [],
                      isFinalResponse: false,
                      systemStatus: 'Summarizing chat history...',
                      agentName: normalizeAgentDisplayName(agent_name),
                    });
                  }
                  return { chatMessages: msgs };
                });
                return;
              }
              case 'summarize_end': {
                set((state) => {
                  const msgs = [...state.chatMessages];
                  const lastAiIdx = msgs.findLastIndex(m => m.sender === 'ai' && m.isStreaming);
                  if (lastAiIdx >= 0) {
                    msgs[lastAiIdx] = { ...msgs[lastAiIdx], systemStatus: null };
                  }
                  return { chatMessages: msgs };
                });
                return;
              }

              // ── tool_call: agent decided to invoke a tool ──────────────
              case 'tool_call': {
                const callName = tool_name || safeContent || 'tool';
                const callArgs = tool_args || {};
                set((state) => {
                  const msgs = [...state.chatMessages];
                  const lastAiIdx = msgs.findLastIndex(
                    (m) => m.sender === 'ai' && !m.isToolDataMessage && m.isStreaming
                  );

                  if (lastAiIdx >= 0) {
                    const existing = msgs[lastAiIdx];
                    const updatedToolCalls = [...existing.toolCalls];
                    const alreadyCalling = updatedToolCalls.some(
                      (tc) => tc.name === callName && tc.status === 'calling'
                    );
                    if (!alreadyCalling) {
                      updatedToolCalls.push({ name: callName, args: callArgs, status: 'calling' });
                    }
                    msgs[lastAiIdx] = {
                      ...existing,
                      toolCalls: updatedToolCalls,
                      isStreaming: true,
                      agentName: normalizeAgentDisplayName(agent_name || existing.agentName),
                    };
                  } else {
                    msgs.push({
                      sender: 'ai',
                      text: '',
                      isStreaming: true,
                      toolCalls: [{ name: callName, args: callArgs, status: 'calling' }],
                      isFinalResponse: false,
                      agentName: normalizeAgentDisplayName(agent_name),
                    });
                  }
                  return { chatMessages: msgs };
                });
                return;
              }

              // ── tool_result: tool finished, attach payload ─────────────
              case 'tool_result': {
                const hasToolOutput = tool_output !== null && tool_output !== undefined;
                const actualData = hasToolOutput ? normalizeToolChunk(tool_output) : '';
                const hasRenderableToolOutput = actualData.trim().length > 0;
                const resultToolName = tool_name || safeContent || 'tool';

                set((state) => {
                  const msgs = [...state.chatMessages];
                  const lastAiIdx = msgs.findLastIndex(
                    (m) => m.sender === 'ai' && !m.isToolDataMessage && m.isStreaming
                  );
                  let resetAccumulatorForNextSegment = false;

                  if (lastAiIdx >= 0) {
                    const existing = msgs[lastAiIdx];
                    // Mark matching tool_call as "done"
                    const updatedToolCalls = existing.toolCalls.map((tc) =>
                      tc.name === resultToolName && tc.status === 'calling'
                        ? { ...tc, status: 'done' as const }
                        : tc
                    );
                    const filteredToolCalls = hasRenderableToolOutput
                      ? updatedToolCalls
                      : updatedToolCalls.filter((tc) => tc.name !== resultToolName);

                    msgs[lastAiIdx] = {
                      ...existing,
                      toolCalls: filteredToolCalls,
                      // End this streaming segment; if more text comes it should continue in a new trailer bubble.
                      isStreaming: false,
                      isFinalResponse: !!is_final,
                      agentName: normalizeAgentDisplayName(agent_name || existing.agentName),
                    };
                  }

                  if (hasRenderableToolOutput) {
                    msgs.push({
                      sender: 'ai',
                      text: '',
                      isStreaming: false,
                      toolCalls: [],
                      isFinalResponse: true,
                      agentName: normalizeAgentDisplayName(agent_name),
                      toolName: resultToolName,
                      toolData: actualData,
                      isToolDataMessage: true,
                    });
                  }

                  // Ensure trailing streaming bubble for upcoming text answer
                  if (!is_final) {
                    const trailing = msgs[msgs.length - 1];
                    const needsTrailer = !(
                      trailing && trailing.sender === 'ai' && trailing.isStreaming && !trailing.isToolDataMessage
                    );
                    if (needsTrailer) {
                      msgs.push({
                        sender: 'ai',
                        text: '',
                        isStreaming: true,
                        toolCalls: [],
                        isFinalResponse: false,
                        agentName: normalizeAgentDisplayName(agent_name),
                        isToolDataMessage: false, // Must be false so the upcoming text chunk picks it up!
                      });
                      resetAccumulatorForNextSegment = true;
                    }
                  }

                  if (resetAccumulatorForNextSegment) {
                    return {
                      chatMessages: msgs,
                      streamingContent: {
                        ...state.streamingContent,
                        [request_id]: '',
                      },
                    };
                  }
                  return { chatMessages: msgs };
                });
                
                // Set currentToolName and currentToolData to track the active tool for subsequent text chunks
                if (!is_final && hasRenderableToolOutput) {
                  set({ 
                    currentToolName: resultToolName,
                    currentToolData: actualData 
                  });
                }
                return;
              }

              // ── text (default): standard chat text ─────────────────────
              case 'text':
              default: {
                const isErrorTrace =
                  safeContent.includes('Error code: 500') ||
                  safeContent.includes('Internal Server Error') ||
                  safeContent.includes('Agent streaming failed');
                const finalContentChunk = isErrorTrace
                  ? 'We encountered a small hiccup on our servers while processing that. Please give it another try in a moment!'
                  : safeContent;
                const finalIsFinal = isErrorTrace ? true : is_final;

                // Update the last AI message
                set((state) => {
                  const msgs = [...state.chatMessages];
                  const lastAiIdx = msgs.findLastIndex(
                    (m) => m.sender === 'ai' && !m.isToolDataMessage && m.isStreaming
                  );
                  const previousStreamedText = state.streamingContent[request_id] || '';
                  const nextStreamedText = isErrorTrace
                    ? finalContentChunk
                    : previousStreamedText + finalContentChunk;
                  const displayText = isErrorTrace
                    ? finalContentChunk
                    : nextStreamedText || safeContent;

                    if (lastAiIdx >= 0) {
                    const existing = msgs[lastAiIdx];
                    // Preserve tool name for agent-context labeling, but do NOT propagate toolData
                    // into non-tool messages (prevents duplicate tool output rendering).
                    const existingToolName = existing.toolName || get().currentToolName;
                    
                    // Check if this is an agent-specific response
                    const isSpecializedAgent = agent_name && !['Tools', 'Assistant', 'Super Agent'].includes(agent_name);
                    const hasCurrentTool = get().currentToolName;
                    const shouldBeAgentSpecific = isSpecializedAgent && hasCurrentTool;
                    
                    msgs[lastAiIdx] = {
                      ...existing,
                      toolName: existingToolName || undefined,
                      toolData: existing.isToolDataMessage ? existing.toolData : null,
                      text: displayText, // displayText already contains accumulated text from streamingContent
                      isStreaming: !finalIsFinal,
                      agentName: existing.agentName, // Preserve original agentName - don't overwrite!
                      isFinalResponse: finalIsFinal,
                      isAgentSpecificResponse: existing.isAgentSpecificResponse || shouldBeAgentSpecific,
                      isToolDataMessage: existing.isToolDataMessage,
                    };
                  } else {
                    const currentTool = get().currentToolName;
                    
                    // Check if this is an agent-specific response
                    const isSpecializedAgent = agent_name && !['Tools', 'Assistant', 'Super Agent'].includes(agent_name);
                    const shouldBeAgentSpecific = isSpecializedAgent && currentTool;
                    
                    msgs.push({
                      sender: 'ai',
                      text: finalContentChunk,
                      isStreaming: true,
                      toolCalls: [],
                      isFinalResponse: false,
                      agentName: normalizeAgentDisplayName(agent_name),
                      toolName: currentTool || '',
                      toolData: null, // Don't inherit toolData - it belongs to the tool message
                      isAgentSpecificResponse: shouldBeAgentSpecific,
                      isToolDataMessage: false,
                    });
                  }
                  return {
                    chatMessages: msgs,
                    streamingContent: {
                      ...state.streamingContent,
                      [request_id]: nextStreamedText,
                    },
                  };
                });

                // Clean up when stream is done
                if (finalIsFinal) {
                  console.log('Streaming complete for:', request_id);
                  set((state) => {
                    const { [request_id]: _, ...rest } = state.streamingContent;
                    const cleanedMessages = state.chatMessages
                      .map((m) => {
                        if (m.sender === 'ai' && m.isStreaming) {
                          return { ...m, isStreaming: false, isFinalResponse: true };
                        }
                        return m;
                      })
                      .filter(
                        (m) =>
                          !(
                            m.sender === 'ai' &&
                            !m.isFinalResponse &&
                            !m.isToolDataMessage &&
                            !(m.text || '').trim() &&
                            !m.toolData &&
                            !m.content // Also check content field
                          )
                      );
                    return {
                      streamingContent: rest,
                      chatMessages: cleanedMessages,
                      isStreaming: false,
                      currentToolName: null, // Clear the current tool name
                      currentToolData: null, // Clear the current tool data
                    };
                  });
                } else if (agent_name === 'Assistant' || agent_name === 'Super Agent') {
                  // Clear currentToolName when the final response from Assistant/Super Agent starts
                  set({ currentToolName: null, currentToolData: null });
                }
                break;
              }
            } // end switch(chunk_type)
          }

          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          // AI_RESPONSE — full history parse (fetched conversations)
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          else if (eventName === 'ai_response') {
            console.log("AI Response received:", message.response);
            const aiMessages: StreamingMessage[] = [];
            const parsed = JSON.parse(message.response);

            for (let i = 0; i < parsed.length; i++) {
              const msg = parsed[i];
              const idArray = msg.id || [];
              const kwargs = msg.kwargs || {};

              if (idArray.includes('HumanMessage')) {
                continue;
              }

              if (idArray.includes('AIMessage')) {
                const agentName = kwargs.name || 'Assistant';
                const rawContent = kwargs.content || "";
                const toolCalls = kwargs.tool_calls || [];
                const isErrorTrace = rawContent.includes('Error code: 500') || rawContent.includes('Internal Server Error') || rawContent.includes('Agent streaming failed');
                const displayContent = isErrorTrace
                  ? "We encountered a small hiccup on our servers while processing that. Please give it another try in a moment!"
                  : rawContent;
                const reasoning = kwargs.response_metadata?.token_usage?.completion_tokens_details?.reasoning_tokens || 0;
                const isTransfer = toolCalls.some((tc: { name: string }) => tc.name.includes('transfer'));
                const isSearch = toolCalls.some((tc: { name: string }) => tc.name.includes('amazon_search'));

                aiMessages.push({
                  agentName,
                  text: displayContent,
                  sender: 'ai',
                  isFinalResponse: !isTransfer && !isSearch,
                  toolCalls: toolCalls.map((tc: any) => ({
                    name: tc.name,
                    args: tc.args || {},
                    status: 'done' as const,
                  })),
                  hasThinking: reasoning > 0,
                  isStreaming: false,
                });
              }

              if (idArray.includes('ToolMessage')) {
                const toolContent = normalizeToolChunk(kwargs.content);
                if (!toolContent) {
                  continue;
                }
                const toolName = kwargs.name || 'tool';

                aiMessages.push({
                  sender: 'ai',
                  text: '',
                  toolCalls: [],
                  isStreaming: false,
                  isFinalResponse: true,
                  isToolDataMessage: true,
                  toolName,
                  toolData: toolContent,
                  agentName: normalizeAgentDisplayName(kwargs.agent_name || kwargs.name),
                });
              }
            }

            set({
              finalStructuredMessages: aiMessages,
              isStreaming: false,
            });
          }

          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          // ERROR / DONE
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          else if (eventName === 'error' || eventName === 'done') {
            if (eventName === 'done') {
              set((state) => {
                const msgs = state.chatMessages.map((m) => {
                  if (m.sender === 'ai' && m.isStreaming) {
                    return { ...m, isStreaming: false, isFinalResponse: true };
                  }
                  return m;
                });
                return { chatMessages: msgs, isStreaming: false };
              });
              return;
            }

            const rawMessage = message.message || message.detail || "";
            const isServerError = rawMessage.includes('500') || rawMessage.includes('Internal Server Error') || rawMessage.includes('Agent streaming failed');
            const displayMessage = isServerError
              ? "We encountered a small hiccup on our servers while processing that. Please give it another try in a moment!"
              : (cleanErrorMessage(rawMessage) || "Server error");

            set((state) => {
              const msgs = [...state.chatMessages];
              const lastAiIndex = msgs.findLastIndex(m => m.sender === 'ai' && m.isStreaming);

              if (lastAiIndex >= 0) {
                msgs[lastAiIndex] = {
                  ...msgs[lastAiIndex],
                  text: displayMessage,
                  isStreaming: false,
                  isFinalResponse: true,
                };
              } else {
                msgs.push({
                  sender: 'ai',
                  text: displayMessage,
                  isStreaming: false,
                  toolCalls: [],
                  isFinalResponse: true,
                  agentName: 'Assistant',
                });
              }

              return { chatMessages: msgs, isStreaming: false };
            });
          }
        } catch (err) {
          console.error("Failed to parse websocket message:", err);
          toast.error("Failed to process server message.");
        }
      };

      ws.onerror = () => {
        console.error("WebSocket error");
        set({ isConnected: false });
        toast.error("WebSocket connection error.");
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        set({ ws: null, isConnected: false });

        const timeout = setTimeout(() => {
          console.log("Reconnecting WebSocket...");
          get().connect(token);
        }, 3000);

        set({ reconnectTimeout: timeout });
      };

      set({ ws });
    },

    disconnect: () => {
      const { ws, reconnectTimeout } = get();
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      set({ ws: null, isConnected: false, reconnectTimeout: null });
    },

    sendMessage: (message: WSMessage, source = "chat") => {
      const { ws, isConnected } = get();
      if (!ws || !isConnected || ws.readyState !== WebSocket.OPEN) {
        toast.error("Cannot send message. WebSocket not connected.");
        return;
      }

      ws.send(JSON.stringify(message));
      set({
        lastSentMessage: message.message,
        lastSentModel: message.model || null,
        lastSentSource: source,
        isStreaming: true,
      });
    },
  })),
    {
      name: 'chat-history-cache',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        chatHistory: state.chatHistory,
        chatHistoryHasMore: state.chatHistoryHasMore,
        chatHistoryScope: state.chatHistoryScope,
        chatHistoryVisibilityMode: state.chatHistoryVisibilityMode,
        chatHistoryLastSyncedAt: state.chatHistoryLastSyncedAt,
      }),
      migrate: (persistedState) => {
        const state = (persistedState || {}) as Partial<WebSocketState>;
        return {
          ...state,
          chatHistory: Array.isArray(state.chatHistory) ? state.chatHistory : [],
          chatHistoryHasMore:
            typeof state.chatHistoryHasMore === 'boolean' ? state.chatHistoryHasMore : true,
          chatHistoryScope: state.chatHistoryScope ?? null,
          chatHistoryVisibilityMode:
            state.chatHistoryVisibilityMode === 'all' ? 'all' : 'current_org',
          chatHistoryLastSyncedAt:
            typeof state.chatHistoryLastSyncedAt === 'number' ? state.chatHistoryLastSyncedAt : 0,
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

export default useWebSocketStore;
