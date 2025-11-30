import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware'; // ← This is the key!
import { toast } from 'sonner';

interface WSMessage {
  type: string;
  message: string;
  model?: string;
  agents?: any[];
}

type ChatMessage = {
  sender: "user" | "ai";
  content: string;
  name?: string;
  isLoading?: boolean;
  isFinalResponse?: boolean;
  toolCalls: { name: string; args: any }[];
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
    finalStructuredMessages: [],
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
          console.log("AI Response received: ", message.response);
    const parsed = JSON.parse(message.response);
    const messages = [];
    const targetAgents = ['SuperAgent', 'product_researcher', 'marketer']; // Add any agent names here

    for (let i = 0; i < parsed.length; i++) {
        const currentMessage = parsed[i];

        // 1. Filter for the AIMessage objects that have a 'name'
        if (currentMessage.type === 'constructor' && 
            currentMessage.id?.includes('AIMessage')) {

            const name = currentMessage.kwargs?.name;
            const content = currentMessage.kwargs?.content?.trim();
            const toolCalls = currentMessage.kwargs?.tool_calls;

            if (i === 0 && currentMessage.id?.includes('HumanMessage')) {
                 messages.push({ 
                    name: 'User', 
                    content: content, 
                    sender: 'user' as const,
                    toolCalls: [],           // Fix 2: Initialize required property
                isFinalResponse: true,
                 });
            }
            
            // b. Capture AI messages from specific agents that have substantial content
            if (name && content && content.length > 5 && targetAgents.includes(name)) {
                
                // Determine if this is a 'typing' (intermediate) message or a final response
                let isFinalResponse = true;
                
                // If it calls a tool (transfer or search) AND has content, it's an announcement (like the initial transfer message)
                if (toolCalls && toolCalls.length > 0) {
                     // Check if content is NOT the final summary (Final summaries don't have tool calls)
                     // If the tool call is a 'transfer_back', the message content is usually just "Transferring back..."
                     const isTransferBack = toolCalls.some((call: any) => call.name === 'transfer_back_to_superagent');
                     if (isTransferBack && content.length < 50) continue; // Skip the brief "Transferring back" message

                     // For the initial "I'll transfer you" message (parsed[1])
                     isFinalResponse = false;
                }

                messages.push({
                    name: name,
                    content: content,
                    sender: 'ai' as const,
                    isFinalResponse: isFinalResponse, 
                    toolCalls: toolCalls
                });
            }
        }
    }
    
    // You'd update your state here:
    set({
        finalStructuredMessages: messages,
        isLoading: false
    });
    
    console.log("CONVERSATION MESSAGES:", messages);
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