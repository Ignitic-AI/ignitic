'use client'

import { useState, useRef } from 'react'
import { ArrowUp, Plus, X, FileText, ChevronUp } from "lucide-react"
import { ChatWindow } from './ChatWindow'
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"
import { TypingText } from '@/components/ui/typing-text';
import useWebSocketStore from '@/app/_store/useWebSocketStore'
import { useOrgStore } from '@/app/_store/useorgStore'

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

export function PromptBox() {
  const [prompt, setPrompt] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [selectedModel, setSelectedModel] = useState<string>(
    AVAILABLE_MODELS.find(m => m.isDefault)?.id || AVAILABLE_MODELS[0].id
  );
  const [isModelListOpen, setIsModelListOpen] = useState(false);

  const router = useRouter()
  const { data: session } = useSession()
  const currentOrg = useOrgStore((s) => s.currentOrg)
  const organizationId = currentOrg?.id ?? null

  const handleSearchClick = async () => {
    if (!prompt.trim() || isNavigating) return;

    setIsNavigating(true);

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
        setIsNavigating(false);
        return;
      }
    }

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

      let finalModel = selectedModel;
      if (uploadedImageUrls.length > 0 || uploadedFileUrls.length > 0) {
        if (finalModel === "z-ai/glm-4.5-air:free") {
          finalModel = "google/gemini-2.5-flash";
          setSelectedModel(finalModel);
        }
      }

      // 2. Prepare payload
      const payload: any = {
        type: "submit_request",
        message: prompt,
        agents: ["product_researcher"],
        model: finalModel,
        organization_id: organizationId || undefined,
      };
      
      if (uploadedImageUrls.length > 0) {
        payload.image_urls = uploadedImageUrls;
      }
      if (uploadedFileUrls.length > 0) {
        payload.file_urls = uploadedFileUrls;
        console.log("SENDING FILE_URLS IN PAYLOAD:", payload);
      }

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
      setSelectedFiles([]);
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

  return (
    <>
      <div className="w-full max-w-3xl mx-auto p-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-semibold text-text-lm dark:text-text mb-6">
            What would you like to automate?
          </h2>
        </div>
        
        <div className="relative flex flex-col w-full bg-bg-light-lm dark:bg-bg-light border border-border/50 dark:border-zinc-600 rounded-2xl shadow-sm hover:border-border/80 transition-colors duration-200 p-4">
          
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
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center w-8 h-8 text-text-muted-lm dark:text-text-muted hover:text-text-lm dark:hover:text-text transition-colors rounded-full hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Plus className="w-5 h-5" />
            </button>
            <input
              type="file"
              multiple
              accept="*/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />

            <div className="flex items-center gap-2">
              {/* Model Selector */}
              <div className="relative">
                <Button 
                  type="button"
                  className="bg-[#191828] hover:bg-[#2a2640] text-white px-4 h-8 rounded-full flex items-center gap-2 text-xs"
                  onClick={() => setIsModelListOpen(!isModelListOpen)}
                >
                  <ChevronUp className={cn(
                    "w-3 h-3 transition-transform",
                    isModelListOpen ? "rotate-180" : ""
                  )} />
                  {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || "Auto"}
                </Button>

                {isModelListOpen && (
                  <div className="absolute bottom-full right-0 mb-2 w-64 bg-white dark:bg-bg-dark rounded-lg shadow-lg border border-border-lm dark:border-border p-2 z-50">
                    {AVAILABLE_MODELS.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800",
                          selectedModel === model.id && "bg-gray-100 dark:bg-gray-800"
                        )}
                        onClick={() => {
                          setSelectedModel(model.id);
                          setIsModelListOpen(false);
                        }}
                      >
                        <div className="font-medium text-sm">{model.name}</div>
                        {model.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {model.description}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

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
