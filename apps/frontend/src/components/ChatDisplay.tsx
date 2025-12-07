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
  isFinalResponse?: boolean;
  toolCalls: { name: string; args: any }[];
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
                    // Use sender type for flex direction
                    msg.sender === "user" ? "flex-row" : "flex-row-reverse" 
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
                        "rounded-2xl p-4 max-w-2xl",
                        msg.sender === "user"
                            ? "bg-[#bdcbf2] text-bg dark:text-bg rounded-tl-none text-xl"
                            : "bg-[#c5cad6] text-bg dark:text-bg rounded-tr-none text-xl",
                        // Conditional margin to separate distinct agent messages
                        index > 0 && messages[index - 1].sender === msg.sender ? "mt-1" : "mt-6" 
                    )}
                >
                    {/* Display the Agent Name - Always show for AI messages */}
                    {msg.sender === "ai" && (
                        <h4 className="font-semibold text-gray-700 mb-2">
                            {msg.name}
                        </h4>
                    )}
                    
                    {/* Handle loading state */}
                    {msg.sender === "ai" && msg.isLoading ? (
                        <ThreeDotsLoader />
                    ) : msg.sender === "ai" && !msg.isFinalResponse && msg.toolCalls?.length > 0 ? (
                        <div className="flex items-center gap-2 pt-2">
                             {/* This is where you display your "typing animation" for intermediate steps */}
                             <span className="italic text-sm">
                                ({msg.toolCalls[0].name.replace(/_/g, ' ')} in progress...)
                             </span>
                             <ThreeDotsLoader />
                        </div>
                    ) : (
                        // Render Content using ReactMarkdown
                        <ReactMarkdown
                            children={msg.content}
                            remarkPlugins={[remarkGfm]}
                            components={{
                                p: ({ node, ...props }) => <p {...props} className="text-xl" />,
                                h2: ({ node, ...props }) => <h2 {...props} className="text-2xl font-bold mt-4 mb-2 border-b pb-1" />,
                                // Add more custom components here (ul, li, etc.)
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