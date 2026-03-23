import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware'; 
import { toast } from 'sonner';
import axios from 'axios';

const cleanErrorMessage = (errorMsg: string) => {
  // Check if the error message contains the Python-dictionary-like structure
  if (typeof errorMsg === 'string' && errorMsg.includes("{'error':")) {
    try {
      // Attempt to extract the main error message and the inner message
      const parts = errorMsg.split(" - {'error':");
      if (parts.length === 2) {
        const mainMsg = parts[0];
        // Try to extract the inner message field
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

const isParsableJson = (value: string): boolean => {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};

const normalizeToolChunk = (raw: unknown): string => {
  if (raw === null || raw === undefined) return '';

  // Stream payloads can arrive as raw objects or as prefixed strings ("ToolData: {...}").
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

    // Keep JSON minified if parseable so renderer can parse reliably later.
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

const mergeToolDataChunks = (existing: string | undefined, incoming: string): string => {
  if (!incoming) return existing || '';
  if (!existing) return incoming;

  const existingClean = existing.replace(TOOL_DATA_PREFIX_REGEX, '').trim();
  const incomingClean = incoming.replace(TOOL_DATA_PREFIX_REGEX, '').trim();

  // If both chunks are complete JSON payloads, keep them separated as distinct entries.
  if (isParsableJson(existingClean) && isParsableJson(incomingClean)) {
    return `${existing}\n${incoming}`;
  }

  // Otherwise treat as streamed continuation of one JSON payload.
  return `${existing}${incoming}`;
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

const isLikelyToolJsonChunk = (raw: unknown, existingToolData?: string): boolean => {
  const text = normalizeStreamText(raw).trim();
  if (!text) return false;

  if (TOOL_DATA_PREFIX_REGEX.test(text)) return true;

  // Continue attaching chunks when the current tool payload is still incomplete JSON.
  if (existingToolData) {
    const existingClean = existingToolData.replace(TOOL_DATA_PREFIX_REGEX, '').trim();
    if (existingClean && !isParsableJson(existingClean)) {
      return true;
    }
  }

  // Heuristics for common e-commerce tool payloads when chunk_type is mislabeled.
  return (
    text.startsWith('{"data":{"products":{"edges"') ||
    text.startsWith('{"products":{"edges"') ||
    text.includes('"products":{"edges"') ||
    text.includes('"gid://shopify/Product/') ||
    text.includes('"asin"')
  );
};

type ChatHistoryItem = {
  id: string;
  name: string;
  thread_id: string;
  agents: string[];
}
interface WSMessage {
  type: string;
  message: string;
  model?: string;
  agents?: any[];
  image_urls?: string[];
  file_urls?: string[];
  organization_id?: string;
  chat_id?: string;
}

type ChatMessage = {
  sender: "user" | "ai";
  content: string;
  name?: string;
  isLoading?: boolean;
  isFinalResponse?: boolean;
  toolCalls: { name: string; args: any }[];
  hasThinking?: boolean; 
  toolData?: string;
  image_urls?: string[];
  file_urls?: string[];
};




interface WebSocketState {
  ws: WebSocket | null;
  isConnected: boolean;
  lastSentMessage: any | null;
  lastSentModel?: string | null;
  lastReceivedMessage: any;
  finalStructuredMessages: ChatMessage[];
  lastToolCalls: any[] | null;
  isLoading: boolean;
  reconnectTimeout: NodeJS.Timeout | null;
  lastSentSource: string | null;
  currentRequestId: string | null;
  currentChatId: string | null;
  chatMessages: ChatMessage[];
  streamingContent: Record<string, string>; 
  chatHistory: ChatHistoryItem[]; 
  isHistoryLoading: boolean;
  chatHistoryScope: string | null;

  fetchChatHistory: (token: string, force?: boolean, organizationId?: string | null) => Promise<void>;
  appendMessage: (message: ChatMessage | ChatMessage[]) => void;
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
  subscribeWithSelector((set, get) => ({
    ws: null,
    isConnected: false,
    lastSentMessage: null,
    lastSentModel: null,
    lastReceivedMessage: null,
    finalStructuredMessages: [],
    lastToolCalls: null,
    isLoading: false,
    reconnectTimeout: null,
    lastSentSource: null,
    currentRequestId: null,
    currentChatId: null,
    chatMessages: [],
    streamingContent: {},
    chatHistory: [], 
    isHistoryLoading: false,
    chatHistoryScope: null,
    setLastSentMessage: (msg, source, model) =>
      set({ lastSentMessage: msg, lastSentSource: source, lastSentModel: model || null }),

    fetchChatHistory: async (token: string, force = false, organizationId: string | null = null) => {
        const nextScope = organizationId || null
        const currentScope = get().chatHistoryScope
        const scopeChanged = currentScope !== nextScope
        // Prevent fetching if already loading or if history already exists (caching)
        if (get().isHistoryLoading || (!force && !scopeChanged && get().chatHistory.length > 0)) {
            return;
        }

        set({ isHistoryLoading: true, ...(scopeChanged ? { chatHistory: [] } : {}) });
        
        try {
            const response = await axios.get('http://localhost:8080/api/v1/agents/chats', {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                params: {
                  organization_id: organizationId || undefined,
                },
            });
            set({ 
                chatHistory: response.data, 
                chatHistoryScope: nextScope,
                isHistoryLoading: false 
            });
            console.log('Chat history loaded into store:', response.data);
        } catch (error) {
            console.error("Failed to fetch chat history:", error);
            set({ isHistoryLoading: false });
        }
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
        // ws.send(JSON.stringify({ type: 'stop', request_id: currentRequestId }));
      }
      
      set((state) => {
        const messages = [...state.chatMessages];
        const lastAiIndex = messages.findLastIndex(m => m.sender === 'ai' && m.isLoading);
        
        if (lastAiIndex >= 0) {
          messages[lastAiIndex] = {
            ...messages[lastAiIndex],
            content: (messages[lastAiIndex].content || "") + "\n\nWe had to Pause the Response",
            isLoading: false
          };
        }
        
        return { 
            isLoading: false, 
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
      const wsUrl = 'ws://localhost:8080/api/v1/agents/ws';
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("WebSocket opened");
        ws.send(JSON.stringify({ type: 'auth', token }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          set({ lastReceivedMessage: message });

          if (message.type === 'connection_success') {
            console.log("WebSocket connected:", message.user_id);
            set({ isConnected: true });
          }

          else if (message.type === 'request_submitted') {
            console.log("Request submitted:", message.request_id);
            set({ isLoading: true,currentRequestId: message.request_id });
          }

          else if (message.type === 'stream_chunk') {
            console.log("Stream chunk received: ", message);
            const { request_id, content, is_final, chat_id, chunk_index, agent_name, chunk_type } = message;
            const safeContent = normalizeStreamText(content);
            
            // Ignore chunks if we've stopped generation (currentRequestId is null or different)
            if (get().currentRequestId !== request_id) {
                return;
            }

            if (chunk_type === 'tool_result' || chunk_type === 'tool_call') {
                set((state) => {
                    const messages = [...state.chatMessages];
                    const lastAiIndex = messages.findLastIndex(m => m.sender === 'ai');
                    if (lastAiIndex >= 0 && chunk_type === 'tool_result' && content) {
                      const actualData = normalizeToolChunk(content);
                        
                        messages[lastAiIndex] = {
                            ...messages[lastAiIndex],
                        toolData: mergeToolDataChunks(messages[lastAiIndex].toolData, actualData) // Real-time tool data attachment
                        };
                        // Give it an informative prefix if empty
                        if (!messages[lastAiIndex].content) {
                            messages[lastAiIndex].content = "I found the following data:";
                        }
                    } else if (lastAiIndex < 0) {
                        messages.push({
                            sender: 'ai',
                            content: chunk_type === 'tool_result' ? "I found the following data:" : "",
                            isLoading: true,
                            toolCalls: [],
                            isFinalResponse: false,
                            name: agent_name || 'Assistant',
                            toolData: chunk_type === 'tool_result' ? normalizeToolChunk(content) : undefined
                        });
                    }
                    return { chatMessages: messages };
                });
                return; // Do not append to text streaming content
            }

            // Some backends stream tool payloads as generic content chunks. Infer and reroute.
            if (chunk_type !== 'tool_call') {
              const lastAi = get().chatMessages.findLast((m) => m.sender === 'ai');
              if (isLikelyToolJsonChunk(content, lastAi?.toolData)) {
                set((state) => {
                  const messages = [...state.chatMessages];
                  const lastAiIndex = messages.findLastIndex((m) => m.sender === 'ai');
                  const actualData = normalizeToolChunk(content);

                  if (lastAiIndex >= 0) {
                    messages[lastAiIndex] = {
                      ...messages[lastAiIndex],
                      toolData: mergeToolDataChunks(messages[lastAiIndex].toolData, actualData),
                      content: messages[lastAiIndex].content || "I found the following data:",
                      isLoading: !is_final,
                      name: agent_name || messages[lastAiIndex].name,
                      isFinalResponse: !!is_final
                    };
                  } else {
                    messages.push({
                      sender: 'ai',
                      content: "I found the following data:",
                      isLoading: !is_final,
                      toolCalls: [],
                      isFinalResponse: !!is_final,
                      name: agent_name || 'Assistant',
                      toolData: actualData
                    });
                  }

                  return { chatMessages: messages };
                });
                return;
              }
            }

            // Capture the real chat_id from the stream chunk to ensure we link subsequent messages correctly
            if (chat_id && get().currentChatId !== chat_id) {
                set({ currentChatId: chat_id });
            }
            
            // Accumulate streaming content
            set((state) => {
              // Intercept raw error strings pushed as dialogue
              const isErrorTrace = safeContent.includes('Error code: 500') || safeContent.includes('Internal Server Error') || safeContent.includes('Agent streaming failed');
              const finalContentChunk = isErrorTrace 
                ? "We encountered a small hiccup on our servers while processing that. Please give it another try in a moment!"
                : safeContent;

              // If it's an error, mark as final so it stops loading
              const finalIsFinal = isErrorTrace ? true : is_final;

              return {
                streamingContent: {
                  ...state.streamingContent,
                  [request_id]: isErrorTrace 
                    ? finalContentChunk 
                    : (state.streamingContent[request_id] || '') + finalContentChunk
                }
              };
            });

            // Update the last AI message in chatMessages with streaming content
            set((state) => {
              const messages = [...state.chatMessages];
              const lastAiIndex = messages.findLastIndex(m => m.sender === 'ai');
              const currentStreamedText = state.streamingContent[request_id];
              
              // Also intercept here just in case
              const isErrorTrace = currentStreamedText?.includes('Error code: 500') || currentStreamedText?.includes('Internal Server Error');
              const displayContent = isErrorTrace 
                ? "We encountered a small hiccup on our servers while processing that. Please give it another try in a moment!"
                : (currentStreamedText || safeContent);

              const finalIsFinal = isErrorTrace ? true : is_final;
              
              if (lastAiIndex >= 0) {
                messages[lastAiIndex] = {
                  ...messages[lastAiIndex],
                  content: displayContent,
                  isLoading: !finalIsFinal,
                  name: agent_name || messages[lastAiIndex].name,
                  isFinalResponse: finalIsFinal
                };
              } else {
                // First chunk - create placeholder AI message
                messages.push({
                  sender: 'ai',
                  content: safeContent,
                  isLoading: true,
                  toolCalls: [],
                  isFinalResponse: false,
                  name: agent_name || 'Assistant'
                });
              }
              
              return { chatMessages: messages };
            });

            if (is_final) {
              console.log("Streaming complete for:", request_id);
              set((state) => {
                // Clean up streaming state
                const { [request_id]: _, ...rest } = state.streamingContent;
                return { 
                  streamingContent: rest,
                  isLoading: false 
                };
              });
            }
          }

         else if (message.type === 'ai_response') {
          console.log("AI Response received: ", message.response);
    // 1. Initialize the array that was missing
    const messages: ChatMessage[] = []; 
    const parsed = JSON.parse(message.response);
    
    
    // 1. Initialize variables for the final content and tool calls.
    let finalContent = "";
    let finalToolCalls = null;

    // 2. Iterate backwards through the messages to find the final AIMessage 
    //    that contains the complete answer.
    for (let i = 0; i < parsed.length; i++) {
    const msg = parsed[i];
    const type = msg.type;
    const idArray = msg.id || [];
    const kwargs = msg.kwargs || {};
    
    // 1. CAPTURE HUMAN MESSAGES
    if (idArray.includes('HumanMessage')) {
        // Skip user messages - already added optimistically
        continue;
    }

    // 2. CAPTURE AI MESSAGES (Including Thinking & Tool Calls)
    if (idArray.includes('AIMessage')) {
        const name = kwargs.name || 'Assistant';
        const rawContent = kwargs.content || "";
        const toolCalls = kwargs.tool_calls || [];
        const isErrorTrace = rawContent.includes('Error code: 500') || rawContent.includes('Internal Server Error') || rawContent.includes('Agent streaming failed');
        const displayContent = isErrorTrace 
          ? "We encountered a small hiccup on our servers while processing that. Please give it another try in a moment!"
          : rawContent;

        // Extract Reasoning/Thinking metadata if available
        const reasoning = kwargs.response_metadata?.token_usage?.completion_tokens_details?.reasoning_tokens || 0;

        // Determine if this message is a "handoff" or "intermediate"
        const isTransfer = toolCalls.some((tc: { name: string }) => tc.name.includes('transfer'));
        const isSearch = toolCalls.some((tc: { name: string }) => tc.name.includes('amazon_search'));

        messages.push({
            name: name,
            content: displayContent,
            sender: 'ai',
            isFinalResponse: !isTransfer && !isSearch, // It's final if it's not handing off or searching
            toolCalls: toolCalls,
            hasThinking: reasoning > 0,
            isLoading: false,
        });
    }

    // 3. CAPTURE TOOL MESSAGES (This is where your Links/Data are!)
    if (idArray.includes('ToolMessage')) {
        // Find the last AI message to attach this data to, 
        // or add it as a system-style update
        const toolContent = typeof kwargs.content === 'string' 
            ? kwargs.content 
            : JSON.stringify(kwargs.content);

        // We append tool results to the last message to ensure links are "captured"
        if (messages.length > 0 && messages[messages.length - 1].sender === 'ai') {
            const lastMsg = messages[messages.length - 1];
            // Store the raw tool data so your UI can render the product cards/links
            lastMsg.toolData = lastMsg.toolData ? lastMsg.toolData + '\n' + toolContent : toolContent; 
            
            // If the AI message was empty but the tool has data, 
            // we ensure the UI knows this is informative
            if (!lastMsg.content && toolContent.includes('http')) {
                lastMsg.content = "I found the following products:";
            }
        }
    }
}

set({
    finalStructuredMessages: messages,
    isLoading: false
});
}
          else if (message.type === 'error') {
            const rawMessage = message.message || "";
            const isServerError = rawMessage.includes('500') || rawMessage.includes('Internal Server Error') || rawMessage.includes('Agent streaming failed');
            
            const displayMessage = isServerError 
              ? "We encountered a small hiccup on our servers while processing that. Please give it another try in a moment!"
              : (cleanErrorMessage(rawMessage) || "Server error");

            // Update the UI by replacing the loading bubble with the error message
            set((state) => {
              const messages = [...state.chatMessages];
              const lastAiIndex = messages.findLastIndex(m => m.sender === 'ai');
              
              if (lastAiIndex >= 0 && messages[lastAiIndex].isLoading) {
                // Replace the currently loading AI placeholder
                messages[lastAiIndex] = {
                  ...messages[lastAiIndex],
                  content: displayMessage,
                  isLoading: false,
                  isFinalResponse: true,
                };
              } else {
                // Add a new AI message entirely
                messages.push({
                  sender: 'ai',
                  content: displayMessage,
                  isLoading: false,
                  toolCalls: [],
                  isFinalResponse: true,
                  name: 'Assistant',
                });
              }
              
              return { chatMessages: messages, isLoading: false };
            });
            
            // Optionally still toast the actual error for debugging visibility (uncomment if desired)
            // toast.error(cleanErrorMessage(rawMessage));
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
    isLoading: true
  });
    },
  }))
);

export default useWebSocketStore;
