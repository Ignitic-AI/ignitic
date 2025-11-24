import { create } from 'zustand';
import { toast } from 'sonner';

interface WebSocketState {
  ws: WebSocket | null;
  isConnected: boolean;
  lastMessage: any | null;
  connect: (token: string) => void;
  disconnect: () => void;
  sendMessage: (message: object) => void;
}

const useWebSocketStore = create<WebSocketState>((set, get) => ({
  ws: null,
  isConnected: false,
  lastMessage: null,

  connect: (token) => {
    // Prevent multiple connections if already connected
    if (get().ws && get().isConnected) {
      console.log("WebSocket connection already established.");
      return;
    }

    const wsUrl = 'ws://localhost:8080/api/v1/agents/ws';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'connection_success') {
          set({ isConnected: true });
          console.log('Global WebSocket connected via Zustand:', message.user_id);
        }
        // Update lastMessage to trigger components
        set({ lastMessage: message.response});
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
        toast.error("Failed to process server message.");
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      set({ isConnected: false });
      toast.error("WebSocket connection error.");
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected.');
      set({ ws: null, isConnected: false });
      // Reconnection can be handled by a parent component that monitors session state
    };

    set({ ws });
  },

  disconnect: () => {
    const ws = get().ws;
    if (ws) {
      ws.close();
      set({ ws: null, isConnected: false });
    }
  },

  sendMessage: (message: object) => {
    const ws = get().ws;
    if (ws && get().isConnected) {
      ws.send(JSON.stringify(message));
    } else {
      console.error("Cannot send message, WebSocket is not connected.");
      toast.error("Cannot send message. Not connected to the server.");
    }
  },
}));

export default useWebSocketStore;