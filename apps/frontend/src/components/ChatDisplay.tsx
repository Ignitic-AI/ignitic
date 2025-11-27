import React from 'react';
import { cn } from '@/lib/utils'; // Assuming cn is imported
import { BotMessageSquare } from 'lucide-react'; // Assuming this icon is imported
import ThreeDotsLoader from "@/components/ThreeDotsLoader"
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ChatMessage = {
  sender: "user" | "ai";
  content: string;
  name?: string;
  isLoading?: boolean;
};

function ChatDisplay({ messages }: { messages: ChatMessage[] }) { 
  return (
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
              <div className="w-14 h-14 bg-black rounded-full shrink-0" />
            )}

            {/* AI Avatar */}
            {msg.sender === "ai" && (
              <div className="w-14 h-14 rounded-full shrink-0 bg-primary flex items-center justify-center">
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
                
                <ReactMarkdown
                  // The source content
                  children={msg.content}
                  // Apply GFM plugin for tables, strikethroughs, etc.
                  remarkPlugins={[remarkGfm]}
                  // This is optional: allows you to customize the rendered HTML elements
                  components={{
                    // Example: Ensure <p> tags don't get the 'whitespace-pre-wrap'
                    p: ({ node, ...props }) => <p {...props} className="text-xl" />,
                    // Example: Style h2 tags (your markdown headings)
                    h2: ({ node, ...props }) => <h2 {...props} className="text-2xl font-bold mt-4 mb-2 border-b pb-2" />,
                    // You can add more custom components for li, ul, table, etc.
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ChatDisplay;