"use client"
import { useEffect, useState, useRef } from "react"
import axios from "axios"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import OrgDropdown from "@/components/OrgDropdown"
import ChatSidebar from "@/components/ChatSidebar"
import { motion } from "framer-motion"
import { CirclePlus, Paperclip, SendHorizonal, ChevronUp, ArrowLeft, ArrowRight, Lock } from "lucide-react"
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarRail,
  SidebarTrigger
} from "@/components/ui/sidebar"
import { ModeToggle } from "@/components/ThemeToggle"
import { cn } from "@/lib/utils"
import { useSession, signIn } from "next-auth/react"
import { toast } from "sonner"
import useWebSocketStore from '@/app/_store/useWebSocketStore'
import ChatDisplay from "@/components/ChatDisplay"
import { SuggestionChips } from "@/components/SuggestionChips"
import { useRouter } from "next/navigation"

type ChatMessage = {
  sender: "user" | "ai";
  content: string;
  name?: string;
  isLoading?: boolean;
  isFinalResponse?: boolean;
  toolCalls: { name: string; args: any }[];
};

type Tool = {
  name: string;
  description?: string;
  parameters?: any;
};

type Model = {
  id: string;
  name: string;
  description?: string;
  maxTokens?: number;
  isDefault?: boolean;
};

type ChatHistoryItem = {
  id: string;
  name: string;
  thread_id: string;
  agents: string[];
}

const AVAILABLE_MODELS: Model[] = [
  {
    id: "z-ai/glm-4.5-air:free",
    name: "GLM 4.5 Air",
    description: "Balanced model for general use",
    isDefault: true
  },
]

export default function Chat() {
  const { data: session, status } = useSession()
  const params = useParams()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signup");
    }
  }, [status, router]);

  const chatId = params?.chatId as string
  const [toolCalls, setToolCalls] = useState<Tool[]>([])
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [selectedModel, setSelectedModel] = useState<string>(
    AVAILABLE_MODELS.find(m => m.isDefault)?.id || AVAILABLE_MODELS[0].id
  );
  
  const [isModelListOpen, setIsModelListOpen] = useState(false);
  const lastSentMessage = useWebSocketStore((s) => s.lastSentMessage);
  const finalStructuredMessages = useWebSocketStore((s) => s.finalStructuredMessages);
  const lastSentSource = useWebSocketStore((s) => s.lastSentSource);
  const currentRequestId = useWebSocketStore((s) => s.currentRequestId);
  const storeAppendMessage = useWebSocketStore((s) => s.appendMessage); 
  const chatMessages = useWebSocketStore((s) => s.chatMessages);
  const chatHistory = useWebSocketStore((s) => s.chatHistory);
  const fetchChatHistory = useWebSocketStore((s) => s.fetchChatHistory);

  useEffect(() => {
    if (chatId && chatId.length > 5 && currentRequestId && currentRequestId !== chatId) {
      console.log(`Replacing temporary URL (${chatId}) with real request ID: ${currentRequestId}`);
      router.replace(`/chat/${currentRequestId}`);
    }
  }, [currentRequestId, chatId, router]);

  useEffect(() => {
    if (lastSentMessage && lastSentSource === "promptbox") {
      console.log("New lastSentMessage detected in PromptBox:", lastSentMessage);
      const userMessage = { sender: "user" as const, content: lastSentMessage,toolCalls: [], isFinalResponse: true };
      setMessages((prev) => [...prev, userMessage, { sender: "ai" as const, content: "", isLoading: true, toolCalls: [], isFinalResponse: false }]);
      useWebSocketStore.getState().clearLastSentMessage();
    }
  }, [lastSentMessage, lastSentSource]);

  useEffect(() => {
    if (session?.user?.token) {
      fetchChatHistory(session.user.token);
    }
  }, [session, fetchChatHistory]);

  useEffect(() => {
    if (finalStructuredMessages && finalStructuredMessages.length > 0) {
      useWebSocketStore.setState((state) => {
        const withoutLoading = state.chatMessages.filter(msg => !msg.isLoading);
        return { 
          chatMessages: [...withoutLoading, ...finalStructuredMessages],
          finalStructuredMessages: [], 
          isLoading: false 
        };
      });
    }
  }, [finalStructuredMessages]);

  // Helper function to extract chat ID from thread_id
  const extractChatId = (threadId: string): string => {
    // Extract string between first _ and second _
    // Format: rabbitmq_d10236b9-1507-49a6-982a-01bbdc8af9d1_7d9ce751-affb-4856-a9ff-dbb9f758c34c
    const parts = threadId.split('_');
    if (parts.length >= 2) {
      return parts[1];
    }
    return threadId;
  };

  // Handle chat history item click
  const handleChatHistoryClick = async (chat: ChatHistoryItem) => {
    const chatId = extractChatId(chat.thread_id);
    
    // Clear current messages
    useWebSocketStore.setState({ 
      chatMessages: [], 
      finalStructuredMessages: [], 
      currentRequestId: null 
    });
    setMessages([]);
    
    // Navigate to the chat
    router.push(`/chat/${chatId}`);
    
    // Fetch messages for this chat
    try {
      console.log("Chat Id: ", chat.id)
      const response = await axios.get(
        `http://localhost:8080/api/v1/agents/chats/${chat.id}/messages`,
        {
          headers: {
            Authorization: `Bearer ${session?.user?.token}`,
          },
        }
      );
      
      // Transform API messages to chat messages format
      const fetchedMessages = response.data.messages.map((msg: any) => ({
        sender: msg.type === 'human' ? 'user' : 'ai',
        content: msg.content || '',
        name: msg.name,
        toolCalls: [],
        isFinalResponse: true,
      }));
      
      useWebSocketStore.setState({ chatMessages: fetchedMessages });
    } catch (err) {
      console.error('Failed to fetch chat messages:', err);
      toast.error('Failed to load chat messages');
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const { isConnected, ws, connect, sendMessage } = useWebSocketStore.getState();

    if (!ws || !isConnected || ws.readyState !== WebSocket.OPEN) {
      console.log("Connecting WebSocket...");
      connect(session?.user?.token);

      try {
        await new Promise<void>((resolve, reject) => {
          const interval = setInterval(() => {
            const state = useWebSocketStore.getState();
            const openOk = state.ws?.readyState === WebSocket.OPEN;
            const authOk = state.lastReceivedMessage?.type === "connection_success";

            if (openOk && authOk) {
              clearInterval(interval);
              resolve();
            }
          }, 100);

          setTimeout(() => reject(new Error("WebSocket connection timeout")), 10_000);
        });
      } catch (err: any) {
        toast.error(err.message || "WebSocket not ready. Try again.");
        return;
      }
    }

    const userMessage = { sender: "user" as const, content: inputValue.trim(), toolCalls: [], isFinalResponse: true };
    const loadingMessage = { sender: "ai" as const, content: "", isLoading: true, toolCalls: [], isFinalResponse: false };

    storeAppendMessage([userMessage, loadingMessage]);
    const messageContent = inputValue.trim();
    setInputValue("");

    const payload = {
      type: "submit_request",
      message: messageContent,
      model: selectedModel,
      agents: [],
    };

    try {
      sendMessage(payload);
    } catch (err: any) {
      console.error("Failed to send message:", err);
      toast.error(err.message || "Failed to send message. Please try again.");
      setMessages((prev) => prev.filter((msg) => !msg.isLoading));
      useWebSocketStore.setState({ isLoading: false });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handlePromptSelect = (prompt: string) => {
    setInputValue(prompt)
  }

  if (status === "loading" || status === "unauthenticated") {
    return null;
  }

  return (
    <div className="flex h-screen bg-bg-light-lm dark:bg-bg-light font-generalSans">
      {/* Left Sidebar */}
      <Sidebar
        className={cn(
          "bg-bg text-white flex flex-col overflow-hidden shadow-lg transition-all duration-300",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        <SidebarHeader className="border-b border-border-lm dark:border-border dark:bg-bg-dark dark:text-text bg-bg-dark-lm text-text-lm">
          <div className="flex items-center justify-between px-2 py-[2px]">
            <Button variant="ghost" className="text-text-lm dark:text-text hover:bg-transparent rounded-lg bg-gray-200 dark:bg-highlight border-1 overflow-hidden" asChild>
              <motion.button
                whileHover="hover"
                initial="initial"
                className="flex items-center gap-2"
                onClick={() => router.push('/')}
              >
                <motion.div
                  variants={{ 
                    initial: { x: 0 },
                    hover: { x: -3 } 
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  className="flex items-center"
                >
                  <ArrowLeft className="w-5 h-5" />
                </motion.div>
                {!isCollapsed && (
                  <motion.span 
                    variants={{ 
                      initial: { x: 0 },
                      hover: { x: 3 } 
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                    className="font-generalSans font-medium text-xl"
                  >
                    Back
                  </motion.span>
                )}
              </motion.button>
            </Button>
            <SidebarTrigger className="dark:bg-info bg-info-lm ml-2 h-8 w-8"/>
          </div>
        </SidebarHeader>

        <SidebarContent className="gap-0 bg-bg-dark-lm dark:bg-bg-dark text-text-lm dark:text-text font-generalSans font-extralight">
          <div className={cn("px-2 py-3", isCollapsed && "justify-center")}>
            <Button className="w-full bg-dblue hover:bg-[#1a2951] text-white rounded-lg flex items-center gap-2" onClick={() => {
              const randomId = crypto.randomUUID();
              setMessages([]); 
              useWebSocketStore.getState().clearLastSentMessage();
              useWebSocketStore.setState({ finalStructuredMessages: [], currentRequestId: null });
              router.push(`/chat/${randomId}`);
            }}>
              <CirclePlus className="w-5 h-5 text-white" />
              {!isCollapsed && "New Chat"}
            </Button>
          </div>
          {!isCollapsed && (
            <div className=" px-4 mt-4 overflow-y-scroll scrollbar-hide">
              <div className="flex flex-col gap-2">
                {[...chatHistory].reverse().map((chat) => (
                  <div 
                    key={chat.id} 
                    className="p-3 rounded-md hover:bg-blue-200 dark:hover:bg-gray-700 cursor-pointer dark:text-white text-text-lm"
                    onClick={() => handleChatHistoryClick(chat)}
                  >
                    <h5>{chat.name}</h5>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SidebarContent>

        <SidebarRail />
      </Sidebar>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col dark:bg-bg-light bg-bg-lm">
        {/* Top Header */}
        <div className="flex items-center justify-between p-2 border-b">
          <OrgDropdown />
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
              className="text-text-lm dark:text-text overflow-hidden"
              asChild
            >
              <motion.button
                whileHover="hover"
                initial="initial"
                className="flex items-center gap-2"
              >
                <motion.span 
                  variants={{ 
                    initial: { x: 0 },
                    hover: { x: -3 } 
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  {isRightSidebarOpen ? "Hide Agents" : "Show Agents"}
                </motion.span>
                <motion.div
                  variants={{ 
                    initial: { x: 0 },
                    hover: { x: 3 } 
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  className="flex items-center"
                >
                  {isRightSidebarOpen ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                </motion.div>
              </motion.button>
            </Button>
            <ModeToggle />
          </div>
        </div>

        {/* Chat Messages */}
        <ChatDisplay messages={chatMessages} />

        {/* Suggestion Chips - Only show when chat is empty */}
        {chatMessages.length === 0 && (
          <SuggestionChips 
            onPromptSelect={handlePromptSelect}
            show={chatMessages.length === 0}
          />
        )}

        {/* Input Area */}
        <div className="bg-transparent p-4 pb-6 ">
          <div className="max-w-4xl mx-auto flex items-center gap-3 relative">
            <div className="flex-1 relative">
              <Paperclip className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-text-lm dark:text-text-muted " />
              <Input
                type="text"
                style={{ fontSize: "18px" }}
                className="w-full h-16 pl-12 pr-14 border-2 border-info-lm dark:border-info  rounded-full focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-text-lm dark:text-white ml-2 text-xl"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full text-text-lm dark:text-white hover:bg-gray-100 hover:text-gray-900"
                onClick={handleSend}
                disabled={!inputValue.trim()}
              >
                <SendHorizonal 
                  className="stroke-text-info dark:stroke-white" 
                  style={{ width: "28px", height: "28px" }}
                />
              </Button>
            </div>

            <div className="flex flex-col items-center relative">
              <Button 
                className="bg-[#191828] hover:bg-[#2a2640] text-white px-6 rounded-full flex items-center gap-2"
                onClick={() => setIsModelListOpen(!isModelListOpen)}
              >
                <ChevronUp className={cn(
                  "w-4 h-4 transition-transform",
                  isModelListOpen ? "rotate-180" : ""
                )} />
                {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || "Auto"}
              </Button>

              {isModelListOpen && (
                <div className="absolute bottom-full mb-2 w-64 bg-white dark:bg-bg-dark rounded-lg shadow-lg border border-border-lm dark:border-border p-2">
                  {AVAILABLE_MODELS.map((model) => (
                    <button
                      key={model.id}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800",
                        selectedModel === model.id && "bg-gray-100 dark:bg-gray-800"
                      )}
                      onClick={() => {
                        setSelectedModel(model.id);
                        setIsModelListOpen(false);
                      }}
                    >
                      <div className="font-medium">{model.name}</div>
                      {model.description && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {model.description}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <span className="text-dblue dark:text-white text-sm text-center leading-tight mt-1">
                Model Selection
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <ChatSidebar toolCalls={toolCalls} isOpen={isRightSidebarOpen} />
    </div>
  )
}