"use client"
import { useEffect, useState, useRef } from "react"
import axios from "axios"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import OrgDropdown from "@/components/OrgDropdown"
import ChatSidebar from "@/components/ChatSidebar"
import { motion } from "framer-motion"
import { CirclePlus, ChevronUp, ArrowLeft, ArrowRight, Lock, Plus, ArrowUp, Square, X } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
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
    description: "For complex agentic flows",
    isDefault: true
  },
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    description: "Lite model for small tasks with multimodal capabilities",
    isDefault: false
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    description: "Balanced model for general use with multimodal capabilities",
    isDefault: false
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
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSentMessage = useWebSocketStore((s) => s.lastSentMessage);
  const finalStructuredMessages = useWebSocketStore((s) => s.finalStructuredMessages);
  const lastSentSource = useWebSocketStore((s) => s.lastSentSource);
  const currentRequestId = useWebSocketStore((s) => s.currentRequestId);
  const storeAppendMessage = useWebSocketStore((s) => s.appendMessage); 
  const chatMessages = useWebSocketStore((s) => s.chatMessages);
  const chatHistory = useWebSocketStore((s) => s.chatHistory);
  const fetchChatHistory = useWebSocketStore((s) => s.fetchChatHistory);
  const isLoading = useWebSocketStore((s) => s.isLoading);
  const stopGeneration = useWebSocketStore((s) => s.stopGeneration);

  useEffect(() => {
    if (chatId && chatId.length > 5 && currentRequestId && currentRequestId !== chatId) {
      console.log(`Replacing temporary URL (${chatId}) with real request ID: ${currentRequestId}`);
      router.replace(`/chat/${currentRequestId}`);
      
      // The chat was just saved for the first time on the backend, refresh the sidebar history
      if (session?.user?.token) {
        fetchChatHistory(session.user.token, true);
      }
    }
  }, [currentRequestId, chatId, router, session, fetchChatHistory]);

  useEffect(() => {
    if (lastSentMessage && lastSentSource === "promptbox") {
      console.log("New lastSentMessage detected in PromptBox:", lastSentMessage);
      const userMessage = { sender: "user" as const, content: lastSentMessage,toolCalls: [], isFinalResponse: true };
      storeAppendMessage([userMessage, { sender: "ai" as const, content: "", isLoading: true, toolCalls: [], isFinalResponse: false }]);
      useWebSocketStore.getState().clearLastSentMessage();
    }
  }, [lastSentMessage, lastSentSource, storeAppendMessage]);

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
        image_urls: msg.image_urls || [],
      }));
      
      useWebSocketStore.setState({ chatMessages: fetchedMessages });
    } catch (err) {
      console.error('Failed to fetch chat messages:', err);
      toast.error('Failed to load chat messages');
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() && selectedImages.length === 0) return;

    if (isUploading) return;
    setIsUploading(true);

    let uploadedImageUrls: string[] = [];
    if (selectedImages.length > 0) {
      try {
        const formData = new FormData();
        selectedImages.forEach(file => formData.append('file', file));
        
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        
        if (!res.ok) {
          throw new Error('Image upload failed');
        }
        
        const data = await res.json();
        uploadedImageUrls = data.urls;
      } catch (err: any) {
        toast.error(err.message || 'Failed to upload images');
        setIsUploading(false);
        return;
      }
    }

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
        setIsUploading(false);
        return;
      }
    }

    const userMessage = { sender: "user" as const, content: inputValue.trim(), toolCalls: [], isFinalResponse: true, ...(uploadedImageUrls.length > 0 && { image_urls: uploadedImageUrls }) };
    const loadingMessage = { sender: "ai" as const, content: "", isLoading: true, toolCalls: [], isFinalResponse: false };

    storeAppendMessage([userMessage, loadingMessage]);
    const messageContent = inputValue.trim();
    setInputValue("");
    setSelectedImages([]);
    
    // Generation will be tracked by isLoading from store, we clear local upload loading now
    setIsUploading(false);

    // Auto-switch to vision model if images are present and current model doesn't support it
    let finalModel = selectedModel;
    if (uploadedImageUrls.length > 0) {
      if (finalModel === "z-ai/glm-4.5-air:free") {
        finalModel = "google/gemini-2.5-flash";
        // Optionally update the UI to show the new model
        setSelectedModel(finalModel);
      }
    }

    const payload: any = {
      type: "submit_request",
      message: messageContent,
      model: finalModel,
      agents: [],
    };
    
    if (uploadedImageUrls.length > 0) {
      payload.image_urls = uploadedImageUrls;
    }

    try {
      sendMessage(payload);
    } catch (err: any) {
      console.error("Failed to send message:", err);
      toast.error(err.message || "Failed to send message. Please try again.");
      setMessages((prev) => prev.filter((msg) => !msg.isLoading));
      useWebSocketStore.setState({ isLoading: false });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedImages(prev => [...prev, ...filesArray]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
              
              // Clear current UI state
              setMessages([]); 
              setToolCalls([]);
              
              // Clear global store states
              useWebSocketStore.getState().clearLastSentMessage();
              useWebSocketStore.setState({ 
                chatMessages: [],
                finalStructuredMessages: [], 
                currentRequestId: null 
              });
              
              // Refresh history in sidebar just in case the user was previously in a chat that got saved
              if (session?.user?.token) {
                fetchChatHistory(session.user.token, true);
              }

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
            <ModeToggle />
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
          <div className="max-w-5xl mx-auto flex items-end gap-3 relative">
            <div className="flex-1 relative flex flex-col w-full bg-bg-light-lm dark:bg-bg-light border border-border/50 dark:border-zinc-600 rounded-2xl shadow-sm hover:border-border/80 transition-colors duration-200 p-4">
              
              {selectedImages.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedImages.map((file, index) => (
                    <div key={index} className="relative w-16 h-16 rounded-md overflow-hidden border border-border/50">
                      <img
                        src={URL.createObjectURL(file)}
                        alt="preview"
                        className="object-cover w-full h-full"
                      />
                      <button
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative w-full min-h-[44px]">
                <Textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type a message..."
                  className="w-full min-h-[40px] max-h-[180px] p-0 text-lg md:text-lg bg-transparent dark:bg-transparent border-none shadow-none focus-visible:ring-0 resize-none text-text-lm dark:text-text placeholder:text-text-muted-lm dark:placeholder:text-text-muted"
                />
              </div>

              <div className="flex justify-between items-center mt-3">
                 {/* Attachment Icon */}
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center w-8 h-8 text-text-muted-lm dark:text-text-muted hover:text-text-lm dark:hover:text-text transition-colors rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <Plus className="w-5 h-5" />
                </button>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />

                <button
                  type="button"
                  onClick={isLoading ? stopGeneration : handleSend}
                  disabled={isUploading || ((!isLoading) && !inputValue.trim() && selectedImages.length === 0)}
                  className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 ${
                    (isLoading || isUploading || inputValue.trim() || selectedImages.length > 0)
                      ? "bg-black dark:bg-white text-white dark:text-black hover:opacity-90 shadow-sm" 
                      : "bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
                  }`}
                >
                  {isUploading ? (
                    <Spinner className="w-4 h-4 text-white dark:text-black" />
                  ) : isLoading ? (
                    <Square className="w-3 h-3 fill-current" />
                  ) : (
                    <ArrowUp className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center relative pb-2">
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