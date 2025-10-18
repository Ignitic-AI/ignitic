"use client"
import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import OrgDropdown from "@/components/OrgDropdown"
import ChatSidebar from "@/components/ChatSidebar"
import { CirclePlus, Paperclip, SendHorizonal, ChevronUp, BotMessageSquare } from "lucide-react"
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarRail
} from "@/components/ui/sidebar"
import { ModeToggle } from "@/components/ThemeToggle"
import Image from "next/image"
import { cn } from "@/lib/utils"
import wlogo from "@/../public/white-logo.png"
import dlogo from "@/../public/dark-logo.png"
import { useSession } from "next-auth/react"

type ChatMessage = {
  sender: "user" | "ai";
  content: string;
  name?: string;
};
// 1. Define the structure for the 'kwargs' object
type MessageKwargs = {
  type: 'ai' | string; // Be specific if you can, e.g., 'ai'
  content: string;
  name?: string; // The '?' makes this property optional
};

// 2. Define the structure for the main message object
type AiResponseMessage = {
  type: 'constructor' | string; // e.g., 'constructor'
  kwargs?: MessageKwargs; // kwargs is also optional
};

export default function Chat() {
  const { data: session, status } = useSession()

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [socketConnected, setSocketConnected] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)

  const WS_URL = "ws://localhost:8080/api/v1/agents/ws"

  // ==================================================================
  // MODIFICATION 2: Improve the useEffect hook
  // ==================================================================
  useEffect(() => {
    // Wait until the session is fully authenticated before connecting.
    if (status !== "authenticated" || !session?.user?.token) {
      if (status === "loading") {
        console.log("... Waiting for session to load ...");
      } else {
        console.warn("⚠️ No authenticated session found, WebSocket connection aborted.");
      }
      return; // Stop here
    }

    console.log("🌐 Session authenticated, connecting to WebSocket:", WS_URL)
    const socket = new WebSocket(
      `${WS_URL}?token=${encodeURIComponent(session.user.token)}`
    )
    socketRef.current = socket

    socket.onopen = () => {
      console.log("✅ WebSocket connection established")
      setSocketConnected(true)
    }

    // ... (rest of your socket event handlers remain the same) ...
    // CORRECTED CODE
socket.onmessage = (event) => {
  console.log("📩 Message from server:", event.data);
  try {
    const data = JSON.parse(event.data);

    if (data.type === "ai_response" && data.response) {
      // Tell TypeScript that responseArray is an array of our new type
      const responseArray: AiResponseMessage[] = JSON.parse(data.response);

      const aiMessages: ChatMessage[] = responseArray
        // The 'msg' parameter is now correctly typed as AiResponseMessage
        .filter((msg) =>
          msg.type === "constructor" &&
          msg.kwargs?.type === "ai" &&
          msg.kwargs?.content // Check for content existence
        )
        // 'msg' is also typed here
        .map((msg) => ({
          sender: "ai",
          // We can use the non-null assertion '!' because the filter guarantees kwargs exists
          content: msg.kwargs!.content,
          name: msg.kwargs!.name || "AI Assistant"
        }));

      if (aiMessages.length > 0) {
        setMessages(prev => [...prev, ...aiMessages]);
      }
    }
  } catch (error) {
    console.error("Error parsing message:", error);
  }
};

    socket.onerror = (error) => {
        console.error("❌ WebSocket error:", error)
    };

    socket.onclose = () => {
        console.log("🔒 WebSocket connection closed")
        setSocketConnected(false)
    };


    return () => {
      socket.close()
    }

    // This dependency array ensures the effect runs only when the status or session changes.
  }, [status, session])


  // Your sendMessage, handleSend, and other functions remain the same
  const sendMessage = (request: {
    type: string
    message: string
    agents?: string[]
    model?: string
    chatId: string
  }) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const payload = {
        type: "submit_request",
        message: request.message,
        agents: request.agents || [],
        model: request.model || "default-model",
        chat_id: request.chatId
      }
      console.log("🚀 Sending message payload:", payload)
      socketRef.current.send(JSON.stringify(payload))
    } else {
      console.error("❌ Cannot send message, WebSocket is not connected.")
    }
  }

  const handleSend = () => {
    if (!inputValue.trim() || !socketConnected) return
    const userMessage = { sender: "user" as const, content: inputValue.trim() }
    setMessages((prev) => [...prev, userMessage])
    sendMessage({
      type: "submit_request",
      message: inputValue.trim(),
      model: "z-ai/glm-4.5-air:free",
      chatId: "chat-session-12345",
      agents: []
    })
    setInputValue("")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-screen bg-bg-light-lm dark:bg-bg-light font-generalSans">
      {/* Left Sidebar */}
      <Sidebar
        className={cn(
          "bg-bg text-white flex flex-col overflow-hidden shadow-lg transition-all duration-300",
          isCollapsed ? "w-16" : "w-80"
        )}
      >
        <SidebarHeader className="border-b border-border-lm dark:border-border dark:bg-bg-dark dark:text-text bg-bg-dark-lm text-text-lm">
          <div className="flex items-center justify-between px-2 py-2">
            <div className="flex items-center gap-2">
              <Image
                src={dlogo}
                alt="White Logo Icon"
                width={20}
                height={14}
                className="rounded block dark:hidden"
              />
              <Image
                src={wlogo}
                alt="Dark Logo Icon"
                width={20}
                height={14}
                className="rounded hidden dark:block"
              />
              {!isCollapsed && (
                <span className="font-generalSans font-semibold text-2xl text-text-lm dark:text-text">
                  Ignitic AI
                </span>
              )}
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="gap-0 bg-bg-dark-lm dark:bg-bg-dark text-text-lm dark:text-text font-generalSans font-extralight">
          <div className={cn("px-2 py-3", isCollapsed && "justify-center")}>
            <Button className="w-full bg-dblue hover:bg-[#1a2951] text-white rounded-lg flex items-center gap-2">
              <CirclePlus className="w-5 h-5 text-white" />
              {!isCollapsed && "New Chat"}
            </Button>
          </div>
        </SidebarContent>

        <SidebarRail />
      </Sidebar>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-bg-light-lm dark:bg-bg-light">
        {/* Top Header */}
        <div className="flex items-center justify-between p-2 border-b">
          <OrgDropdown />
          <ModeToggle />
        </div>

        {/* Chat Messages */}
        <div className="flex-1 p-6 overflow-y-auto">
  <div className="max-w-7xl mx-auto space-y-6">
    {messages.map((msg, index) => (
      <div
        key={index}
        className={cn(
          "flex items-start gap-3",
          msg.sender === "ai" ? "flex-row-reverse" : "flex-row"
        )}
      >
        {/* User Avatar */}
        {msg.sender === "user" && (
          <div className="w-14 h-14 bg-black rounded-full flex-shrink-0" />
        )}

        {/* AI Avatar */}
        {msg.sender === "ai" && (
  <div className="w-14 h-14 rounded-full flex-shrink-0 bg-primary flex items-center justify-center">
    <BotMessageSquare 
      className="w-10 h-10 text-primary-foreground" 
      strokeWidth={2}
    />
  </div>
)}

        {/* Message Bubble */}
        <div
          className={cn(
            "rounded-2xl p-4 max-w-2xl mt-3",
            msg.sender === "user"
              ? "bg-[#bdcbf2] text-bg dark:text-bg rounded-tl-none text-xl"
              : "bg-[#c5cad6] text-bg dark:text-bg rounded-tr-none text-xl"
          )}
        >
          {msg.name && (
            <h4 className="font-semibold text-bg ">
              {msg.name}
            </h4>
          )}
          <p className="whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    ))}
  </div>
</div>

        {/* Input Area */}
        <div className="bg-transparent p-4 mb-4">
          <div className="max-w-4xl mx-auto flex items-center gap-3 relative">
            <div className="flex-1 relative">
              <Paperclip className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-text-lm dark:text-text-muted " />
              <Input
                type="text"
                style={{ fontSize: "18px" }}
                className="w-full h-16 pl-12 pr-14 border-2 border-info-lm dark:border-info  rounded-full focus-visible:ring-0 focus-visible:ring-offset-0 bg-text text-text-lm dark:text-white ml-2 text-xl"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  socketConnected
                    ? "Type a message..."
                    : "Getting things ready..."
                }
                disabled={!socketConnected}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full text-text-lm dark:text-white hover:bg-gray-100 hover:text-gray-900"
                onClick={handleSend}
                disabled={!inputValue.trim() || !socketConnected}
              >
                <SendHorizonal 
  className="stroke-text-lm dark:stroke-white" 
  style={{ width: "28px", height: "28px" }}
/>
              </Button>
            </div>

            <div className="flex flex-col items-center">
              <Button className="bg-[#191828] hover:bg-[#2a2640] text-white px-6 rounded-full">
                <ChevronUp className="w-4 h-4 text-white" />
                Auto
              </Button>
              <span className="text-dblue dark:text-white text-sm text-center leading-tight mt-1">
                Model Selection
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <ChatSidebar />
    </div>
  )
}

