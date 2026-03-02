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
  lastReceivedMessage: any;
  finalStructuredMessages: ChatMessage[];
  lastToolCalls: any[] | null;
  isLoading: boolean;
  reconnectTimeout: NodeJS.Timeout | null;
  lastSentSource: string | null;
  currentRequestId: string | null;
  chatMessages: ChatMessage[];
  streamingContent: Record<string, string>; // request_id -> accumulated content
  chatHistory: ChatHistoryItem[]; 
  isHistoryLoading: boolean;
  chatHistoryScope: string | null;

  fetchChatHistory: (token: string, force?: boolean, organizationId?: string | null) => Promise<void>;
  appendMessage: (message: ChatMessage | ChatMessage[]) => void;
  connect: (token: string) => void;
  disconnect: () => void;
  sendMessage: (message: WSMessage, source?: string) => void;
  setLastSentMessage: (msg: string | null, source: string | null) => void;
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
    lastReceivedMessage: null,
    finalStructuredMessages: [],
    lastToolCalls: null,
    isLoading: false,
    reconnectTimeout: null,
    lastSentSource: null,
    currentRequestId: null,
    chatMessages: [],
    streamingContent: {},
    chatHistory: [], 
    isHistoryLoading: false,
    chatHistoryScope: null,
    setLastSentMessage: (msg, source) =>
      set({ lastSentMessage: msg, lastSentSource: source }),

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
      set({ lastSentMessage: null, lastSentSource: null }),

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
            const { request_id, content, is_final, chat_id, chunk_index, agent_name } = message;
            
            // Ignore chunks if we've stopped generation (currentRequestId is null or different)
            if (get().currentRequestId !== request_id) {
                return;
            }
            
            // Accumulate streaming content
            set((state) => {
              // Intercept raw error strings pushed as dialogue
              const isErrorTrace = content.includes('Error code: 500') || content.includes('Internal Server Error') || content.includes('Agent streaming failed');
              const finalContentChunk = isErrorTrace 
                ? "We encountered a small hiccup on our servers while processing that. Please give it another try in a moment!"
                : content;

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
                : (currentStreamedText || content);

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
                  content: content,
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
            lastMsg.toolData = toolContent; 
            
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
    lastSentSource: source,
    isLoading: true
  });
    },
  }))
);

export default useWebSocketStore;
