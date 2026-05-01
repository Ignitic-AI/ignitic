"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import ChatDisplay from "@/components/ChatDisplay";
import { StreamingMessage } from "@/types/chat";
import { API_V1_BASE_URL } from "@/lib/api";

function normalizeSharedMessages(messages: any[]): StreamingMessage[] {
  const normalized: StreamingMessage[] = [];

  for (const item of messages || []) {
    const msg = item?.data || item;
    const msgType = msg?.type;
    const content = typeof msg?.content === "string" ? msg.content.trim() : "";
    if (!content) continue;

    if (msgType === "human") {
      normalized.push({
        sender: "user",
        text: content,
        content,
        toolCalls: [],
        isFinalResponse: true,
        image_urls: Array.isArray(msg?.image_urls) ? msg.image_urls : [],
        file_urls: Array.isArray(msg?.file_urls) ? msg.file_urls : [],
      });
      continue;
    }
    if (msgType === "ai") {
      const toolCalls = Array.isArray(msg?.tool_calls)
        ? msg.tool_calls
            .map((tool: any) => ({
              name: typeof tool?.name === "string" ? tool.name : "tool",
              args:
                tool?.args && typeof tool.args === "object"
                  ? tool.args
                  : {},
              status: "done" as const,
            }))
            .filter((tool: any) => tool.name)
        : [];

      normalized.push({
        sender: "ai",
        text: content,
        content,
        toolCalls,
        isFinalResponse: true,
        agentName: typeof msg?.name === "string" ? msg.name : "Assistant",
      });
      continue;
    }
    if (msgType === "tool") {
      const toolContentRaw = msg?.content;
      const toolContent =
        typeof toolContentRaw === "string"
          ? toolContentRaw
          : JSON.stringify(toolContentRaw ?? "");
      if (!toolContent.trim()) continue;

      const toolName = typeof msg?.name === "string" ? msg.name : "tool";
      normalized.push({
        sender: "ai",
        text: "",
        content: "",
        agentName: toolName,
        toolCalls: [],
        toolName,
        toolData: toolContent,
        isToolDataMessage: true,
        isTransferMessage: toolName.toLowerCase().startsWith("transfer_to_"),
        isFinalResponse: true,
      });
    }
  }

  return normalized;
}

export default function SharedChatPage() {
  const params = useParams();
  const token = params?.token as string;
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    const fetchSharedChat = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await axios.get(
          `${API_V1_BASE_URL}/public/agents/chats/shared/${token}`
        );
        if (!isMounted) return;
        setMessages(Array.isArray(response?.data?.messages) ? response.data.messages : []);
      } catch (err: any) {
        if (!isMounted) return;
        const detail = err?.response?.data?.detail || err?.response?.data?.error;
        setError(detail || "Unable to load shared chat.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchSharedChat();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const normalizedMessages = useMemo(() => normalizeSharedMessages(messages), [messages]);

  return (
    <main className="min-h-screen flex flex-col bg-bg-lm dark:bg-bg-light text-text-lm dark:text-text font-generalSans">
      <div className="mx-auto w-full max-w-5xl px-4 pt-6 pb-2">
        <header className="border-b border-border-lm dark:border-border pb-4">
          <h1 className="text-3xl font-bold font-generalSans">Shared Chat</h1>
          <p className="mt-1 text-sm font-medium font-generalSans text-text-muted-lm dark:text-text-muted">
            Read-only view. Sending messages and editing this conversation are disabled.
          </p>
        </header>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner className="w-6 h-6 text-text-lm dark:text-text" />
        </div>
      )}

      {!isLoading && error && (
        <div className="mx-auto w-full max-w-5xl px-4 py-4">
          <div className="rounded-[4px] border border-red-300 bg-red-50 p-4 text-sm font-medium font-generalSans text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        </div>
      )}

      {!isLoading && !error && normalizedMessages.length === 0 && (
        <div className="mx-auto w-full max-w-5xl px-4 py-4">
          <div className="rounded-[4px] border border-border-lm dark:border-border p-4 text-sm font-medium font-generalSans text-text-muted-lm dark:text-text-muted">
            No messages are available for this shared chat.
          </div>
        </div>
      )}

      {!isLoading && !error && normalizedMessages.length > 0 && (
        <ChatDisplay messages={normalizedMessages} />
      )}
    </main>
  );
}
