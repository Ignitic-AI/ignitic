"use client"
import { useEffect, useState, useRef } from "react"
import axios from "axios"
import { useParams, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import OrgDropdown from "@/components/OrgDropdown"
import ChatSidebar from "@/components/ChatSidebar"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronUp, ArrowLeft, ArrowRight, Plus, ArrowUp, Square, X, FileText, MoreVertical, Trash2, Share2, Copy } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarRail,
  SidebarTrigger,
  useSidebar
} from "@/components/ui/sidebar"
import { ModeToggle } from "@/components/ThemeToggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useSession, signIn } from "next-auth/react"
import { toast } from "sonner"
import useWebSocketStore, { type ChatHistoryVisibilityMode } from '@/app/_store/useWebSocketStore'
import ChatDisplay from "@/components/ChatDisplay"
import { SuggestionChips } from "@/components/SuggestionChips"
import { useRouter } from "next/navigation"
import { useCredits } from "@/context/credits-context"
import { CreditsBlockedState } from "@/components/credits/CreditsBlockedState"
import { useOrgStore } from "@/app/_store/useorgStore"
import { StreamingMessage } from '@/types/chat';
import { SavedItemsSheet } from "@/components/SavedItemsSheet";


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
  org_id?: string | null;
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

const DEFAULT_MODEL_ID = AVAILABLE_MODELS.find((m) => m.isDefault)?.id || AVAILABLE_MODELS[0].id;
const MODEL_STORAGE_KEY = "chat.selectedModel";

export default function Chat() {
  const { data: session, status } = useSession()
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { canUseFeatureAction, canUseModel, isLoading: isCreditsLoading } = useCredits()
  const currentOrg = useOrgStore((s) => s.currentOrg)
  const organizationId = currentOrg?.id ?? null

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signup");
    }
  }, [status, router]);

  const chatId = params?.chatId as string
  const [toolCalls, setToolCalls] = useState<Tool[]>([])
  const { state: sidebarState } = useSidebar()
  const isCollapsed = sidebarState === "collapsed"
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [messages, setMessages] = useState<StreamingMessage[]>([])
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const lastSentModel = useWebSocketStore.getState().lastSentModel;
    if (lastSentModel && AVAILABLE_MODELS.some((m) => m.id === lastSentModel)) {
      return lastSentModel;
    }

    if (typeof window !== "undefined") {
      const persistedModel = window.localStorage.getItem(MODEL_STORAGE_KEY);
      if (persistedModel && AVAILABLE_MODELS.some((m) => m.id === persistedModel)) {
        return persistedModel;
      }
    }

    return DEFAULT_MODEL_ID;
  });
  const allowedModels = AVAILABLE_MODELS.filter((m) => canUseModel(m.id))
  
  const [isModelListOpen, setIsModelListOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSentMessage = useWebSocketStore((s) => s.lastSentMessage);
  const finalStructuredMessages = useWebSocketStore((s) => s.finalStructuredMessages);
  const lastSentSource = useWebSocketStore((s) => s.lastSentSource);
  const currentRequestId = useWebSocketStore((s) => s.currentRequestId);
  const currentChatId = useWebSocketStore((s) => s.currentChatId);
  const storeAppendMessage = useWebSocketStore((s) => s.appendMessage); 
  const chatMessages = useWebSocketStore((s) => s.chatMessages);
  const chatHistory = useWebSocketStore((s) => s.chatHistory);
  const isHistoryLoading = useWebSocketStore((s) => s.isHistoryLoading);
  const isHistoryLoadingMore = useWebSocketStore((s) => s.isHistoryLoadingMore);
  const hasHydrated = useWebSocketStore((s) => s.hasHydrated);
  const setChatHistoryVisibilityMode = useWebSocketStore((s) => s.setChatHistoryVisibilityMode);
  const fetchChatHistory = useWebSocketStore((s) => s.fetchChatHistory);
  const loadMoreChatHistory = useWebSocketStore((s) => s.loadMoreChatHistory);
  const prependChatHistoryItem = useWebSocketStore((s) => s.prependChatHistoryItem);
  const removeChatHistoryItem = useWebSocketStore((s) => s.removeChatHistoryItem);
  const markChatHistoryStale = useWebSocketStore((s) => s.markChatHistoryStale);
  const isLoading = useWebSocketStore((s) => s.isStreaming);
  const stopGeneration = useWebSocketStore((s) => s.stopGeneration);
  const chatAccess = canUseFeatureAction("agent.chat", selectedModel)
  const chatBlocked = !isCreditsLoading && !chatAccess.allowed
  const historyContainerRef = useRef<HTMLDivElement>(null);
  const [chatScopeMode, setChatScopeMode] = useState<ChatHistoryVisibilityMode>('current_org');
  const prefillHandledRef = useRef<string | null>(null);

  useEffect(() => {
    // Always reset to current_org scope on org context changes, including personal mode (null org).
    setChatScopeMode('current_org');
  }, [organizationId]);

  useEffect(() => {
    const prefillPrompt = searchParams.get("prompt");
    if (!prefillPrompt || prefillHandledRef.current === prefillPrompt) return;

    prefillHandledRef.current = prefillPrompt;
    setInputValue(prefillPrompt);
    router.replace(`/chat/${chatId}`);
  }, [searchParams, router, chatId]);

  useEffect(() => {
    setChatHistoryVisibilityMode(chatScopeMode);
  }, [chatScopeMode, setChatHistoryVisibilityMode]);

  useEffect(() => {
    if (!AVAILABLE_MODELS.some((m) => m.id === selectedModel)) {
      setSelectedModel(DEFAULT_MODEL_ID)
    }
  }, [selectedModel])

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
    }
  }, [selectedModel]);

  useEffect(() => {
    const currentChatExistsInHistory = !!chatHistory.find((chat) => chat.id === currentChatId);
    const isTemporaryRouteId = !!chatId && chatId.length !== 24;

    if (
      chatId &&
      currentChatId &&
      currentChatId !== chatId &&
      isTemporaryRouteId &&
      !currentChatExistsInHistory
    ) {
      console.log(`Replacing temporary URL (${chatId}) with real chat ID: ${currentChatId}`);
      router.replace(`/chat/${currentChatId}`);
      
      // Cache immediately so sidebar updates without forcing a full refresh.
      if (session?.user?.token) {
        prependChatHistoryItem(
          {
            id: currentChatId,
            name: "New Chat",
            thread_id: currentChatId,
            agents: [],
          },
          organizationId,
          chatScopeMode
        );
        markChatHistoryStale(organizationId, chatScopeMode);
        fetchChatHistory(session.user.token, false, organizationId, chatScopeMode);
      }
    }
  }, [currentChatId, chatId, chatHistory, router, session, prependChatHistoryItem, markChatHistoryStale, fetchChatHistory, organizationId, chatScopeMode]);

  const lastSentModel = useWebSocketStore((s) => s.lastSentModel);

  useEffect(() => {
    if (lastSentMessage && lastSentSource === "promptbox") {
      console.log("New lastSentMessage detected in PromptBox:", lastSentMessage);
      
      if (lastSentModel) {
        setSelectedModel(lastSentModel);
      }
      
      const userMessage = { sender: "user" as const, text: lastSentMessage,toolCalls: [], isFinalResponse: true };
      storeAppendMessage([userMessage, { sender: "ai" as const, text: "", isStreaming: true, toolCalls: [], isFinalResponse: false }]);
      useWebSocketStore.getState().clearLastSentMessage();
    }
  }, [lastSentMessage, lastSentSource, storeAppendMessage, lastSentModel, setSelectedModel]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (session?.user?.token) {
      fetchChatHistory(session.user.token, false, organizationId, chatScopeMode);
    }
  }, [session, fetchChatHistory, organizationId, hasHydrated, chatScopeMode]);

  const handleHistoryScroll = () => {
    if (!session?.user?.token) return;
    const container = historyContainerRef.current;
    if (!container) return;

    const threshold = 100;
    const nearBottom =
      container.scrollTop + container.clientHeight >= container.scrollHeight - threshold;

    if (nearBottom) {
      loadMoreChatHistory(session.user.token, organizationId, chatScopeMode);
    }
  };

  useEffect(() => {
    if (finalStructuredMessages && finalStructuredMessages.length > 0) {
      useWebSocketStore.setState((state) => {
        const withoutLoading = state.chatMessages.filter(msg => !msg.isStreaming);
        const buildMessageKey = (msg: any) => {
          const toolData = typeof msg.toolData === 'string' ? msg.toolData : '';
          return `${msg.sender || ''}|${msg.name || ''}|${(msg.content || '').trim()}|${toolData.trim()}`;
        };

        const existingKeys = new Set(withoutLoading.map(buildMessageKey));
        const dedupedFinalMessages = finalStructuredMessages.filter((msg: any) => !existingKeys.has(buildMessageKey(msg)));

        return { 
          chatMessages: [...withoutLoading, ...dedupedFinalMessages],
          finalStructuredMessages: [], 
          isStreaming: false 
        };
      });
    }
  }, [finalStructuredMessages]);

  const [isDeleting, setIsDeleting] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<ChatHistoryItem | null>(null);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [generatedShareLink, setGeneratedShareLink] = useState("");

  // Handle chat delete
  const handleDeleteChat = async () => {
    if (!chatToDelete) return;
    setIsDeleting(true);
    try {
      const response = await axios.delete(
        `http://localhost:8080/api/v1/agents/chats/${chatToDelete.id}`,
        {
          headers: {
            Authorization: `Bearer ${session?.user?.token}`,
          },
        }
      );
      if (response.data.success) {
        toast.success(response.data.message || "Chat deleted successfully");
        removeChatHistoryItem(chatToDelete.id);
        if (session?.user?.token) {
          markChatHistoryStale(organizationId, chatScopeMode);
          fetchChatHistory(session.user.token, false, organizationId, chatScopeMode);
        }
        if (chatId === chatToDelete.id || currentChatId === chatToDelete.id) {
           router.push(`/chat/${crypto.randomUUID()}`); 
           useWebSocketStore.setState({ 
            chatMessages: [],
            finalStructuredMessages: [], 
            currentRequestId: null,
            currentChatId: null
          });
        }
      } else {
        toast.error("Deletion was not successful");
      }
    } catch (error) {
      toast.error("Deletion was not successful");
    } finally {
      setIsDeleting(false);
      setChatToDelete(null);
    }
  };

  const handleOpenShareDialog = async () => {
    const persistedChatId =
      (currentChatId && currentChatId.length === 24 && currentChatId) ||
      (chatId && chatId.length === 24 && chatId) ||
      null;

    if (!persistedChatId) {
      toast.error("Please send a message first to generate a shareable link.");
      return;
    }

    if (!session?.user?.token) {
      toast.error("You must be signed in to share this chat.");
      return;
    }

    setIsShareDialogOpen(true);
    setIsShareLoading(true);
    try {
      const response = await axios.post(
        `http://localhost:8080/api/v1/agents/chats/${persistedChatId}/share`,
        {},
        {
          headers: {
            Authorization: `Bearer ${session.user.token}`,
          },
        }
      );

      const sharePath = response?.data?.share_url_path || `/shared/chat/${response?.data?.token}`;
      setGeneratedShareLink(`${window.location.origin}${sharePath}`);
    } catch (error) {
      toast.error("Failed to generate share link");
    } finally {
      setIsShareLoading(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!generatedShareLink) return;
    try {
      await navigator.clipboard.writeText(generatedShareLink);
      toast.success("Share link copied");
    } catch {
      toast.error("Unable to copy link");
    }
  };

  // Handle chat history item click
  const handleChatHistoryClick = async (chat: ChatHistoryItem) => {
    // Clear current messages
    useWebSocketStore.setState({ 
      chatMessages: [], 
      finalStructuredMessages: [], 
      currentRequestId: null,
      currentChatId: chat.id
    });
    setMessages([]);
    
    // Navigate to the chat
    router.push(`/chat/${chat.id}`);
    
    // Fetch messages for this chat
    try {
      console.log("Chat Id: ", chat.id)
      const response = await axios.get(
        `http://localhost:8080/api/v1/agents/chats/${chat.id}/messages`,
        {
          headers: {
            Authorization: `Bearer ${session?.user?.token}`,
          },
          params: {
            organization_id: organizationId || undefined,
          },
        }
      );
      
// Transform API messages to chat messages format
      const fetchedMessages: StreamingMessage[] = [];
      let lastRequestId: string | null = null;
      response.data.messages.forEach((msg: any) => {
        // Handle both wrapped format {"data": ..., "request_id": ...} and direct format
        const msgData = msg.data || msg;
        
        // Extract request_id from the message (embedded by ai-engine)
        const msgRequestId = msg.request_id;
        if (msgRequestId) {
          lastRequestId = msgRequestId;
        }
        
        const msgType = msgData.type;
        const msgContent = msgData.content;
        const msgName = msgData.name;
        
        if (msgType === 'human') {
          fetchedMessages.push({
            sender: 'user',
            text: msgContent || '',
            agentName: msgName,
            toolCalls: [],
            isFinalResponse: true,
            image_urls: msgData.image_urls || [],
          });
        } else if (msgType === 'ai') {
          fetchedMessages.push({
            sender: 'ai',
            text: msgContent || '',
            content: msgContent || '',
            agentName: msgName,
            toolCalls: msgData.tool_calls || [],
            isFinalResponse: true,
            image_urls: msgData.image_urls || [],
            hasThinking: false, // Will be set if there's a reasoning message
          });
} else if (msgType === 'thought' || msgType === 'reasoning') {
          // Add thinking content to the last AI message
          if (fetchedMessages.length > 0 && fetchedMessages[fetchedMessages.length - 1].sender === 'ai') {
            const lastMsg = fetchedMessages[fetchedMessages.length - 1];
            lastMsg.hasThinking = true;
            lastMsg.text = (lastMsg.text || '') + '\n' + (msgContent || '');
          }
        } else if (msgType === 'tool') {
          const toolContentRaw = msgData.content;
          const toolContent =
            typeof toolContentRaw === 'string' ? toolContentRaw : JSON.stringify(toolContentRaw);
          const toolName = msgName || "tool";
          const hasToolOutput =
            toolContentRaw !== null &&
            toolContentRaw !== undefined &&
            toolContent.trim().length > 0;

          if (hasToolOutput) {
            fetchedMessages.push({
              sender: 'ai',
              text: '',
              agentName: toolName,
              toolCalls: [],
              toolName,
              toolData: toolContent,
              isToolDataMessage: true,
              isFinalResponse: true,
              image_urls: [],
            });
          }
        }
      });
      
      // Set the request_id from messages if not already set
      if (lastRequestId && !useWebSocketStore.getState().currentRequestId) {
        useWebSocketStore.setState({ currentRequestId: lastRequestId });
      }
      
      useWebSocketStore.setState({ chatMessages: fetchedMessages });
    } catch (err) {
      console.error('Failed to fetch chat messages:', err);
      toast.error('Failed to load chat messages');
    }
  };

  const activeHistoryChatId = currentChatId || (chatId?.length === 24 ? chatId : null);

  const handleSend = async () => {
    if (!inputValue.trim() && selectedFiles.length === 0) return;
    const actionCheck = canUseFeatureAction("agent.chat", selectedModel)
    if (!actionCheck.allowed) {
      toast.error(actionCheck.reason || "Chat is not allowed on your current plan.")
      return
    }

    if (isUploading) return;
    setIsUploading(true);

    let uploadedImageUrls: string[] = [];
    let uploadedFileUrls: string[] = [];
    if (selectedFiles.length > 0) {
      try {
        const formData = new FormData();
        selectedFiles.forEach(file => formData.append('file', file));
        
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        
        if (!res.ok) {
          throw new Error('File upload failed');
        }
        
        const data = await res.json();
        
        selectedFiles.forEach((file, index) => {
          if (file.type.startsWith('image/')) {
            uploadedImageUrls.push(data.urls[index]);
          } else {
            uploadedFileUrls.push(data.urls[index]);
          }
        });
      } catch (err: any) {
        toast.error(err.message || 'Failed to upload files');
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

    const userMessage = { 
      sender: "user" as const, 
      text: inputValue.trim(), 
      toolCalls: [], 
      isFinalResponse: true, 
      ...(uploadedImageUrls.length > 0 && { image_urls: uploadedImageUrls }),
      ...(uploadedFileUrls.length > 0 && { file_urls: uploadedFileUrls })
    };
    const loadingMessage = { sender: "ai" as const, text: "", isStreaming: true, toolCalls: [], isFinalResponse: false };

    storeAppendMessage([userMessage, loadingMessage]);
    const messageContent = inputValue.trim();
    setInputValue("");
    setSelectedFiles([]);
    
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

    // Resolve the actual chat ID: prefer the one established in the store, otherwise use the URL ID if it's a valid Mongo ObjectID (24 hex characters)
    let actualChatId = currentChatId;
    if (!actualChatId && chatId && chatId.length === 24) {
      actualChatId = chatId;
    }

    const payload: any = {
      type: "submit_request",
      message: messageContent,
      model: finalModel,
      agents: [],
      organization_id: organizationId || undefined,
      is_org: !!organizationId,
      ...(actualChatId && { chat_id: actualChatId }),
    };
    
    if (uploadedImageUrls.length > 0) {
      payload.image_urls = uploadedImageUrls;
    }
    if (uploadedFileUrls.length > 0) {
      payload.file_urls = uploadedFileUrls;
      console.log("SENDING FILE_URLS IN PAYLOAD:", payload);
    }

    console.log("User sent message:", messageContent, "with model:", finalModel);

    try {
      sendMessage(payload);
    } catch (err: any) {
      console.error("Failed to send message:", err);
      toast.error(err.message || "Failed to send message. Please try again.");
      setMessages((prev) => prev.filter((msg) => !msg.isStreaming));
      useWebSocketStore.setState({ isStreaming: false });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...filesArray]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
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
  if (chatBlocked) {
    return <CreditsBlockedState title="Chat unavailable" message={chatAccess.reason || "You cannot use chat in the current scope."} />
  }

  return (
    <div className="flex h-screen bg-bg-light-lm dark:bg-bg-light font-generalSans">
      {/* Left Sidebar */}
      <Sidebar
        collapsible="icon"
        className={cn(
          "bg-bg text-white flex flex-col overflow-hidden shadow-lg transition-all duration-300",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        <SidebarHeader className="border-b border-border-lm dark:border-border dark:bg-bg-dark dark:text-text bg-bg-dark-lm text-text-lm">
          <div className={cn("flex items-center px-2 py-[2px]", isCollapsed ? "justify-center" : "justify-between")}>
            <Button
              variant="ghost"
              className={cn(
                "text-text-lm dark:text-text rounded-lg overflow-hidden transition-all duration-200",
                isCollapsed
                  ? "h-9 w-9 p-0 !bg-transparent dark:!bg-transparent !border-0 border-transparent dark:border-transparent !shadow-none hover:!shadow-none hover:!bg-transparent dark:hover:!bg-transparent"
                  : "hover:bg-bg-lm dark:hover:bg-bg bg-bg-light-lm dark:bg-bg-light shadow-sm hover:shadow-md "
              )}
              asChild
            >
              <motion.button
                whileHover="hover"
                initial="initial"
                className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-2 px-3 py-2")}
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
            {!isCollapsed && <SidebarTrigger className="dark:bg-info bg-info-lm ml-2 h-8 w-8" />}
          </div>
        </SidebarHeader>

        <SidebarContent className="gap-0 bg-bg-dark-lm dark:bg-bg-dark text-text-lm dark:text-text font-generalSans font-extralight">
          <div className={cn("px-2 pt-3", isCollapsed && "flex justify-center")}>
            <Button
              className={cn(
                "rounded-sm flex items-center font-generalSans text-sm font-medium border-2 border-highlight-lm dark:border-border bg-[linear-gradient(180deg,var(--color-bg-light-lm)_0%,var(--color-bg-dark-lm)_100%)] dark:bg-[linear-gradient(180deg,var(--color-bg-light)_0%,var(--color-bg)_100%)] text-text-lm dark:text-text hover:opacity-90 transition-opacity",
                isCollapsed ? "h-9 w-9 justify-center p-0" : "w-full gap-2"
              )}
              onClick={() => {
              const randomId = crypto.randomUUID();
              
              // Clear current UI state
              setMessages([]); 
              setToolCalls([]);
              
              // Clear global store states
              useWebSocketStore.getState().clearLastSentMessage();
              useWebSocketStore.setState({ 
                chatMessages: [],
                finalStructuredMessages: [], 
                currentRequestId: null,
                currentChatId: null
              });
              
              router.push(`/chat/${randomId}`);
            }}
            >
              <Plus className="w-5 h-5 text-text-lm dark:text-text" strokeWidth={4} />
              {!isCollapsed && "New Chat"}
            </Button>
          </div>
          {!isCollapsed && (
            <div
              ref={historyContainerRef}
              onScroll={handleHistoryScroll}
              className=" px-2 mt-4 overflow-y-scroll scrollbar-hide"
            >
              {organizationId && (
                <div className="mb-3 flex rounded-full p-1 backdrop-blur-md bg-white/20 dark:bg-white/10 shadow-sm">
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(
                      "h-7 px-3 text-xs flex-1 rounded-full transition-colors",
                      chatScopeMode === "current_org"
                        ? "bg-white/60 dark:bg-white/20 text-text-lm dark:text-text"
                        : "bg-transparent text-text-muted-lm dark:text-text-muted"
                    )}
                    onClick={() => setChatScopeMode("current_org")}
                  >
                    Current Org
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(
                      "h-7 px-3 text-xs flex-1 rounded-full transition-colors",
                      chatScopeMode === "all"
                        ? "bg-white/60 dark:bg-white/20 text-text-lm dark:text-text"
                        : "bg-transparent text-text-muted-lm dark:text-text-muted"
                    )}
                    onClick={() => setChatScopeMode("all")}
                  >
                    All Chats
                  </Button>
                </div>
              )}
              {isHistoryLoading ? (
                <div className="flex justify-center py-6">
                  <Spinner className="w-6 h-6 text-text-lm dark:text-text opacity-50" />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <AnimatePresence initial={false}>
                    {chatHistory.map((chat) => (
                      <motion.div
                        key={chat.id}
                        layout
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className={cn(
                          "group/chat relative p-3 rounded-md cursor-pointer pr-8 transition-colors",
                          activeHistoryChatId === chat.id
                            ? "bg-white/60 dark:bg-white/20 text-text-lm dark:text-text"
                            : "text-text-muted-lm dark:text-text-muted hover:bg-blue-200 dark:hover:bg-gray-700"
                        )}
                        onClick={() => handleChatHistoryClick(chat)}
                      >
                        <h5 
                          className="truncate"
                          onMouseEnter={(e) => {
                            const target = e.currentTarget;
                            if (target.dataset.hovering === 'true') return;
                            if (target.scrollWidth > target.clientWidth) {
                              target.style.textOverflow = 'clip';
                              target.dataset.hovering = 'true';
                              let scrollAmount = 0;
                              const step = () => {
                                if (target.dataset.hovering !== 'true') return;
                                scrollAmount += 1;
                                if (scrollAmount >= target.scrollWidth - target.clientWidth + 20) {
                                  scrollAmount = 0;
                                }
                                target.scrollLeft = scrollAmount;
                                requestAnimationFrame(step);
                              };
                              requestAnimationFrame(step);
                            }
                          }}
                          onMouseLeave={(e) => {
                            const target = e.currentTarget;
                            target.dataset.hovering = 'false';
                            target.style.textOverflow = 'ellipsis';
                            target.scrollLeft = 0;
                          }}
                        >
                          {chat.name}
                        </h5>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/chat:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-6 w-6 p-0 hover:bg-transparent">
                                <span className="sr-only">Open menu</span>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent 
                              align="start" 
                              side="bottom" 
                              sideOffset={3}
                              className="bg-bg-light-lm dark:bg-bg-light border border-border-lm dark:border-border rounded-[4px] shadow-lg p-0 min-w-[120px] overflow-hidden"
                            >
                              <DropdownMenuItem
                                className="w-full font-generalSans text-sm font-medium text-text-lm dark:text-text hover:text-danger-lm dark:hover:text-danger hover:bg-danger-lm/15 dark:hover:bg-danger/20 cursor-pointer focus:bg-danger-lm/15 dark:focus:bg-danger/20 focus:text-danger-lm dark:focus:text-danger rounded-none px-2 py-2"
                                onClick={() => setChatToDelete(chat)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Delete</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                {isHistoryLoadingMore && (
                  <div className="flex justify-center py-2">
                    <Spinner className="w-4 h-4 text-text-lm dark:text-text opacity-50" />
                  </div>
                )}
              </div>
              )}
            </div>
          )}
        </SidebarContent>

        <SidebarRail />
      </Sidebar>

      {/* Main Chat Area */}
      <div className="flex-1 min-h-0 flex flex-col dark:bg-bg-light bg-bg-lm">
        {/* Top Header */}
        <div className="flex items-center justify-between p-2 border-b">
          <div className="flex items-center gap-2">
            {isCollapsed && <SidebarTrigger className="dark:bg-info bg-info-lm h-8 w-8" />}
            <OrgDropdown />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-text-lm dark:text-text"
              onClick={handleOpenShareDialog}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Chat
            </Button>
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
              
              {selectedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedFiles.map((file, index) => {
                    const isImage = file.type.startsWith('image/');
                    return (
                    <div key={index} className="relative w-16 h-16 rounded-md overflow-hidden border border-border/50 bg-zinc-100 dark:bg-zinc-800 flex flex-col items-center justify-center text-center">
                      {isImage ? (
                        <img
                          src={URL.createObjectURL(file)}
                          alt="preview"
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <>
                          <FileText className="w-6 h-6 text-zinc-500 mb-1" />
                          <span className="text-[9px] text-zinc-500 w-14 px-1 line-clamp-1 break-all" title={file.name}>{file.name}</span>
                        </>
                      )}
                      <button
                        onClick={() => removeFile(index)}
                        className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 rounded-full p-0.5 z-10"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  )})}
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
                <div className="flex items-center gap-1">
                  {/* Attachment Icon */}
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center w-8 h-8 text-text-muted-lm dark:text-text-muted hover:text-text-lm dark:hover:text-text transition-colors rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  <SavedItemsSheet />
                </div>
                <input
                  type="file"
                  multiple
                  accept="*/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />

                <button
                  type="button"
                  onClick={isLoading ? stopGeneration : handleSend}
                  disabled={isUploading || ((!isLoading) && !inputValue.trim() && selectedFiles.length === 0) || !chatAccess.allowed}
                  className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 ${
                    (isLoading || isUploading || inputValue.trim() || selectedFiles.length > 0)
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
                {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || "No Model"}
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

      {/* Delete Chat Dialog */}
      <Dialog open={!!chatToDelete} onOpenChange={(open) => !open && setChatToDelete(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-[4px]">
          <DialogHeader>
            <DialogTitle>Delete Chat</DialogTitle>
            <DialogDescription>
              This action will delete "All Message History from this Chat". Are you sure you want to proceed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-[4px]" onClick={() => setChatToDelete(null)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" className="rounded-[4px]" onClick={handleDeleteChat} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-[560px] rounded-[4px]">
          <DialogHeader>
            <DialogTitle>Share Chat</DialogTitle>
            <DialogDescription>
              This link opens a read-only view of this chat for anyone with the URL.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium text-text-lm dark:text-text">Generated Link</label>
            <Textarea
              value={isShareLoading ? "Generating link..." : generatedShareLink}
              readOnly
              rows={3}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-[4px]" onClick={() => setIsShareDialogOpen(false)}>
              Close
            </Button>
            <Button
              className="rounded-[4px]"
              onClick={handleCopyShareLink}
              disabled={isShareLoading || !generatedShareLink}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
