"use client"
import { useEffect, useState } from "react"
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
import ThreeDotsLoader from "@/components/ThreeDotsLoader"

type ChatMessage = {
  sender: "user" | "ai";
  content: string;
  name?: string;
  isLoading?: boolean;
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

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [tools, setTools] = useState<Tool[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(
    AVAILABLE_MODELS.find(m => m.isDefault)?.id || AVAILABLE_MODELS[0].id
  );
  const [isModelListOpen, setIsModelListOpen] = useState(false);

  const handleSend = () => {
    if (!inputValue.trim()) return
    const userMessage = { sender: "user" as const, content: inputValue.trim() }
    const loadingMessage = { 
      sender: "ai" as const, 
      content: "", 
      isLoading: true 
    }
    setMessages((prev) => [...prev, userMessage, loadingMessage])
    setInputValue("")
    // Note: No actual message sending since WebSocket is removed
    setTimeout(() => {
      setMessages(prev => {
        const withoutLoading = prev.filter(msg => !msg.isLoading);
        return [...withoutLoading, {
          sender: "ai",
          content: "Response placeholder (WebSocket removed)",
          name: "AI Assistant"
        }];
      });
      setIsLoading(false);
    }, 1000);
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
          isCollapsed ? "w-16" : "w-64"
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
                  {msg.sender === "ai" && msg.name && (
                    <h4 className="font-semibold text-bg mb-2">
                      {msg.name}
                    </h4>
                  )}
                  {msg.isLoading ? (
                    <div className="flex items-center gap-2 pt-2">
                      <ThreeDotsLoader />
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
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
                  className="stroke-text-lm dark:stroke-white" 
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
      <ChatSidebar toolCalls={tools} />
    </div>
  )
}