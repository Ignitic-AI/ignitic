import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { BotMessageSquare, ExternalLink, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { Spinner } from "@/components/ui/spinner";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import wlogo from "@/../public/white-logo.svg"
import dlogo from "@/../public/dark-logo.svg"
import Image from 'next/image';

// Updated type to match your new parser
type ChatMessage = {
    sender: "user" | "ai";
    content: string;
    name?: string;
    isLoading?: boolean;
    isFinalResponse?: boolean;
    toolCalls: { name: string; args: any }[];
    hasThinking?: boolean;
    toolData?: string;
};

// Helper component to render the Links
function ProductGrid({ data }: { data: string }) {
    try {
        const products = JSON.parse(data);
        if (!Array.isArray(products)) return null;

        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                {products.map((product: any, i: number) => (
                    <a 
                        key={product.asin || i} 
                        href={product.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex flex-col bg-white rounded-xl border p-3 hover:shadow-md transition-shadow group"
                    >
                        {product.imageUrl && (
                            <img 
                                src={product.imageUrl} 
                                alt={product.title} 
                                className="h-32 w-full object-contain mb-2 rounded"
                            />
                        )}
                        <p className="text-sm font-medium line-clamp-2 group-hover:text-primary leading-tight">
                            {product.title}
                        </p>
                        <div className="mt-auto pt-2 flex items-center justify-between">
                            <span className="text-lg font-bold text-green-600">${product.price}</span>
                            {product.rating && (
                                <div className="flex items-center text-xs text-gray-500">
                                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 mr-1" />
                                    {product.rating.split(' ')[0]}
                                </div>
                            )}
                        </div>
                        <div className="text-[10px] text-blue-500 flex items-center mt-1">
                             View on Amazon <ExternalLink className="w-2 h-2 ml-1" />
                        </div>
                    </a>
                ))}
            </div>
        );
    } catch (e) {
        return null;
    }
}

function ChatDisplay({ messages }: { messages: ChatMessage[] }) {
    // Track collapsed state for each message (default: expanded)
    const [collapsedMessages, setCollapsedMessages] = useState<Set<number>>(new Set());

    const toggleMessage = (index: number) => {
        setCollapsedMessages(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    return (
        <div className="flex-1 p-4 overflow-y-auto dark:bg-bg-light bg-bg-lm">
            <div className="max-w-5xl mx-auto space-y-1 pr-32">
                {messages.map((msg, index) => {
                    // Skip empty messages only if they are not loading and have no content
                    if (!msg.content?.trim() && !msg.isLoading && !msg.toolData) {
                        return null;
                    }

                    const isExpanded = !collapsedMessages.has(index);
                    // Allow collapsing if it's an AI message (only after loading is complete)
                    const isCollapsible = msg.sender === 'ai' && !msg.isLoading && !msg.isFinalResponse;
                    
                    return (
                        <div
                            key={index}
                            className={cn(
                                "flex items-start gap-3",
                                msg.sender === "user" ? "flex-row" : "flex-row-reverse"
                            )}
                        >
                            {/* Avatar Logic */}
                            <div className={cn(
                                "w-12 h-12 rounded-full shrink-0 flex items-center justify-center",
                                msg.sender === "user" ? "bg-black" : "bg-transparent"
                            )}>
                                {msg.sender === "ai" && (
                                    <>
                                        <Image src={dlogo} alt="AI" className="w-8 h-8 object-contain dark:hidden block" />
                                        <Image src={wlogo} alt="AI" className="w-8 h-8 object-contain hidden dark:block" />
                                    </>
                                )}
                            </div>

                            {/* Message Container */}
                            <div className="flex flex-col gap-1">
                                <div
                                    className={cn(
                                        "rounded-xl px-4 py-2 transition-all inline-block max-w-2xl",
                                        msg.sender === "user"
                                            ? "shadow-sm bg-[#bdcbf2] dark:bg-chatBg text-slate-900 dark:text-white rounded-tl-none"
                                            : "bg-transparent text-slate-800 dark:text-slate-200 rounded-tr-none px-0",
                                        index > 0 && messages[index - 1].sender === msg.sender ? "mt-1" : "mt-2",
                                        isCollapsible && !isExpanded && "cursor-pointer hover:shadow-md"
                                    )}
                                    onClick={() => isCollapsible && !isExpanded && toggleMessage(index)}
                                >
                                    {/* Agent Name Tag - Inside Bubble */}
                                    {msg.sender === "ai" && (!isCollapsible || isExpanded) && (
                                        <div className={cn(
                                            "flex items-center gap-2 mb-1",
                                            msg.sender === "ai" ? "justify-start" : "justify-end"
                                        )}>
                                            {isCollapsible && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleMessage(index);
                                                    }}
                                                    className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
                                                >
                                                    <ChevronUp className="w-3 h-3 opacity-60" />
                                                </button>
                                            )}
                                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                                                {msg.name || "Assistant"}
                                            </span>
                                            
                                        </div>
                                    )}

                                    {/* Collapsed View */}
                                    {isCollapsible && !isExpanded ? (
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                            <ChevronDown className="w-4 h-4" />
                                            <span className="font-semibold">{msg.name || "Agent"}</span>
                                        </div>
                                    ) : (
                                        <>

                                            {/* Show loader only if loading AND no content yet */}
                                            {msg.isLoading && !msg.content ? (
                                                <div className='p-2'>
<Spinner />
                                                </div>
                                                
                                            ) : (
                                                <>
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                        components={{
                                                            p: ({ ...props }) => <p {...props} className="text-base leading-relaxed mb-2" />,
                                                            h2: ({ ...props }) => <h2 {...props} className="text-lg font-bold mt-4 mb-2 border-b pb-1" />,
                                                            ul: ({ ...props }) => <ul {...props} className="list-disc ml-5 mb-2" />,
                                                            li: ({ ...props }) => <li {...props} className="text-base mb-1" />,
                                                        }}
                                                    >
                                                        {msg.content}
                                                    </ReactMarkdown>

                                                    {/* Streaming indicator (optional, but helpful) */}
                                                    {msg.isLoading && (
                                                        <span className="inline-block w-2 h-4 ml-1 bg-gray-400 animate-pulse align-middle" />
                                                    )}

                                                    {/* Render Tool Data if available */}
                                                    {msg.toolData && <ProductGrid data={msg.toolData} />}
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default ChatDisplay;