'use client'

import { useState } from 'react'
import { Send } from "lucide-react"
import { ChatWindow } from './ChatWindow'
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import axios from "axios"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"
import { TypingText } from '@/components/ui/typing-text';
import useWebSocketStore from '@/app/_store/useWebSocketStore'

export function PromptBox() {
  const [prompt, setPrompt] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  
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



  return (
    <>
      <div className="dark:bg-transparent bg-transparent rounded-xl p-6 ">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-semibold text-text-lm dark:text-text mb-6">
            What would you like to automate?
          </h2>
        </div>
        
        <form onSubmit={(e) => { e.preventDefault(); handleSearchClick(); }} className="relative">
          <div className="relative flex items-center w-full">
            {!prompt && (
              <div className="absolute left-14 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <TypingText
                  texts={[
                    "Automate customer onboarding emails",
                    "Generate Leads for your New Product",
                    "Process Invoices"
                  ]}
                  className="text-base text-text-muted-lm dark:text-text-muted"
                  speed={55}
                  loop={true}
                  pauseDuration={1600}
                  showCursor={true}
                  cursor="|"
                  cursorClassName="font-generalSans"
                />
              </div>
            )}
            
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full pl-12 pr-26 py-3 text-lg border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-bg-light-lm dark:bg-bg-light hover:border-slate-300 transition-all duration-100 text-text-lm dark:text-text"
            />
            <button
              type="button"
              onClick={handleSearchClick}
              disabled={!prompt.trim() || isNavigating}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center justify-center bg-transparent  px-6 py-3  transition-all duration-100 disabled:opacity-50   group"
            >
              {isNavigating ? (
                <Spinner />
              ) : (
                <Send className="w-8 h-8 text-blue-600 transition-colors duration-150 group-hover:text-blue-300" />
              )}
            </button>
          </div>
        </form>
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
