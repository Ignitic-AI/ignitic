export type StreamingMessage = {
  id?: string;
  sender: 'user' | 'ai';
  text: string;
  content?: string;
  agentName?: string;
  isStreaming?: boolean;
  systemStatus?: string | null;
  toolCalls: Array<{
    name: string;
    args: Record<string, any>;
    status: 'calling' | 'done';
  }>;
  toolName?: string;
  isFinalResponse?: boolean;
  hasThinking?: boolean; 
  toolData?: any;
  isToolDataMessage?: boolean;
  isTransferMessage?: boolean;
  image_urls?: string[];
  file_urls?: string[];
  isAgentSpecificResponse?: boolean;
};
