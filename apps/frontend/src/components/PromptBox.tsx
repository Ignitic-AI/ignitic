'use client'

import { useState } from 'react'
import { ArrowUp, Plus } from "lucide-react"
import { ChatWindow } from './ChatWindow'
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"
import { TypingText } from '@/components/ui/typing-text';
import useWebSocketStore from '@/app/_store/useWebSocketStore'

export function PromptBox() {
  const [prompt, setPrompt] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  
  const router = useRouter()
  const { data: session } = useSession()

  const handleSearchClick = async () => {
    if (!prompt.trim() || isNavigating) return;

    setIsNavigating(true);

    if (!session?.user?.token) {
      toast.error("Authentication error. Please log in again.");
      setIsNavigating(false);
      return;
    }

    const { connect, sendMessage } = useWebSocketStore.getState();

    try {
      // 1. Ensure WebSocket is CONNECTED + AUTHENTICATED
      const state = useWebSocketStore.getState();
      if (!state.ws || !state.isConnected || state.ws.readyState !== WebSocket.OPEN) {
        console.log("Connecting WebSocket via Zustand store...");
        connect(session.user.token);
      }

      // Wait for the connection to be established
      await new Promise<void>((resolve, reject) => {
        const interval = setInterval(() => {
          const wsState = useWebSocketStore.getState();
          if (wsState.isConnected) {
            clearInterval(interval);
            resolve();
          }
        }, 100);

        setTimeout(() => {
          clearInterval(interval);
          reject(new Error("WebSocket connection timeout"));
        }, 10_000);
      });

      // 2. Prepare payload
      const payload = {
        type: "submit_request",
        message: prompt,
        agents: ["product_researcher"],
        model: "z-ai/glm-4.5-air:free",
      };

      // 3. Wait for request_submitted BEFORE sending router.push()
      const requestId = await new Promise<string>((resolve, reject) => {
        let resolved = false;

        const interval = setInterval(() => {
          if (resolved) return;

          const { lastReceivedMessage } = useWebSocketStore.getState();
          const msg = lastReceivedMessage;

          if (msg?.type === "request_submitted" && msg.request_id) {
            resolved = true;
            clearInterval(interval);
            clearTimeout(timeout);
            resolve(msg.request_id);
          }

          if (msg?.type === "error") {
            resolved = true;
            clearInterval(interval);
            clearTimeout(timeout);
            reject(new Error(msg.message || "Server error"));
          }
        }, 100);

        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            clearInterval(interval);
            reject(new Error("Timeout: No chat created"));
          }
        }, 15_000);

        // Send the request after listener is ready
        sendMessage(payload, "promptbox");
      });

      // 4. router.push ONLY runs here, ONLY once requestId exists
      console.log("Chat created successfully → request_id:", requestId);
      router.push(`/chat/${requestId}`);

    } catch (err: any) {
      console.error("Failed to create chat:", err);
      toast.error(err.message || "Failed to start chat. Please try again.");
      setIsNavigating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearchClick();
    }
  };

  return (
    <>
      <div className="w-full max-w-3xl mx-auto p-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-semibold text-text-lm dark:text-text mb-6">
            What would you like to automate?
          </h2>
        </div>
        
        <div className="relative flex flex-col w-full bg-bg-light-lm dark:bg-bg-light border border-border/50 dark:border-zinc-600 rounded-2xl shadow-sm hover:border-border/80 transition-colors duration-200 p-4">
          
          <div className="relative w-full min-h-[44px]">
            {!isFocused && !prompt && (
              <div className="absolute left-0 top-0 pointer-events-none">
                <TypingText
                  texts={[
                    "Automate customer onboarding emails",
                    "Generate Leads for your New Product",
                    "Process Invoices"
                  ]}
                  className="text-lg text-text-muted-lm dark:text-text-muted"
                  speed={55}
                  loop={true}
                  pauseDuration={1600}
                  showCursor={true}
                  cursor="|"
                  cursorClassName="font-generalSans"
                />
              </div>
            )}
            
            <Textarea
              value={prompt}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              className="w-full min-h-[44px] max-h-[200px] p-0 text-lg md:text-lg bg-transparent dark:bg-transparent border-none shadow-none focus-visible:ring-0 resize-none text-text-lm dark:text-text placeholder:text-transparent"
            />
          </div>

          <div className="flex justify-between items-center mt-3">
             {/* Attachment Icon */}
            <button 
              type="button"
              className="flex items-center justify-center w-8 h-8 text-text-muted-lm dark:text-text-muted hover:text-text-lm dark:hover:text-text transition-colors rounded-full hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Plus className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={handleSearchClick}
              disabled={!prompt.trim() || isNavigating}
              className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 ${
                prompt.trim() && !isNavigating
                  ? "bg-white text-black hover:opacity-90 shadow-sm" 
                  : "bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
              }`}
            >
              {isNavigating ? (
                <Spinner className="w-4 h-4" />
              ) : (
                <ArrowUp className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Chat Window */}
      <ChatWindow 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)}
        initialQuery={prompt}
      />
    </>
  )
}
