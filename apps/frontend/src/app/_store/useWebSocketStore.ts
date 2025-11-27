import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware'; // ← This is the key!
import { toast } from 'sonner';

interface WSMessage {
  type: string;
  message: string;
  model?: string;
  agents?: any[];
}


interface WebSocketState {
  ws: WebSocket | null;
  isConnected: boolean;
  lastSentMessage: any | null;
  lastReceivedMessage: any;
  lastParsedAIResponse: string | null;
  lastToolCalls: any[] | null;
  isLoading: boolean;
  reconnectTimeout: NodeJS.Timeout | null;
  lastSentSource: string | null;

  connect: (token: string) => void;
  disconnect: () => void;
  sendMessage: (message: WSMessage, source?: string) => void;
  setLastSentMessage: (msg: string | null, source: string | null) => void;
  clearLastSentMessage: () => void;

  setLastSentSource: (source: string | null) => void;
  clearLastSentSource: () => void;
}

const useWebSocketStore = create<WebSocketState>()(
  subscribeWithSelector((set, get) => ({
    ws: null,
    isConnected: false,
    lastSentMessage: null,
    lastReceivedMessage: null,
    lastParsedAIResponse: null,
    lastToolCalls: null,
    isLoading: false,
    reconnectTimeout: null,
    lastSentSource: null,
    setLastSentMessage: (msg, source) =>
      set({ lastSentMessage: msg, lastSentSource: source }),

    clearLastSentMessage: () =>
      set({ lastSentMessage: null, lastSentSource: null }),

    setLastSentSource: (source) =>
      set({ lastSentSource: source }),

    clearLastSentSource: () =>
      set({ lastSentSource: null }),
    

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
            set({ isLoading: true });
          }

          else if (message.type === 'ai_response') {
    const parsed = JSON.parse(message.response);
    
    // 1. Initialize variables for the final content and tool calls.
    let finalContent = "";
    let finalToolCalls = null;

    // 2. Iterate backwards through the messages to find the final AIMessage 
    //    that contains the complete answer.
    for (let i = parsed.length - 1; i >= 0; i--) {
        const currentMessage = parsed[i];
        
        // Check if the current message is an AIMessage (type: 'constructor', id includes 'AIMessage')
        // and does *not* contain tool calls for transferring, which usually 
        // indicates an intermediate message.
        // The final response you want (parsed[10]) has toolCalls: [].
        if (currentMessage.type === 'constructor' && 
            currentMessage.id?.includes('AIMessage') && 
            currentMessage.kwargs?.content) {
            
            const content = currentMessage.kwargs.content.trim();
            const toolCalls = currentMessage.kwargs.tool_calls;
            
            // Check for the final content length to ensure it's the rich, complete message.
            // The transfer-back message is typically very short.
            if (content.length > 50) { // A heuristic to skip short transfer messages
                finalContent = content;
                finalToolCalls = toolCalls ?? []; // Capture tool calls (even if empty)
                break; // Found the final message, so stop iterating
            }
        }
    }

    // 3. Update the state with the discovered final response
    set({
        lastParsedAIResponse: finalContent,
        lastToolCalls: finalToolCalls,
        isLoading: false
    });
    
    console.log("AI RESPONSE (Final):", { finalContent, finalToolCalls });
}

          else if (message.type === 'error') {
            toast.error(message.message || "Server error");
            set({ isLoading: false });
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