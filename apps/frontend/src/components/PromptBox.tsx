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
    if (!prompt.trim()) return
    if (isNavigating) return
    
    setIsNavigating(true)
    console.log("User id: ", session?.user?.id)

    try {
      const { data } = await axios.post(
        "http://localhost:8080/api/v1/agents/chat",
        {
          message: prompt,
          agents: ["product_researcher"],
          model: "z-ai/glm-4.5-air:free",
          user_id: session?.user?.id, 
        },
        {
          headers: {
            "Authorization": `Bearer ${session?.user?.token}`,
          },
        }
      )
      
      if (data.request_id) {
        console.log("Request ID: ", data.request_id)
        router.push(`/chat/${data.request_id}`)
      } else {
        toast.error("Failed to create chat. Please try again.")
        setIsNavigating(false)
      }
    } catch (err) {
      console.error("Error creating chat:", err)
      toast.error("Error creating chat. Please check your connection and try again.")
      setIsNavigating(false)
    }
  }

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
              className="w-full pl-14 pr-28 py-4 text-lg border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-bg-light-lm dark:bg-bg-light hover:border-slate-300 transition-all duration-100 text-text-lm dark:text-text"
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
