import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { BotMessageSquare, ExternalLink, Star, BrainCircuit, ChevronDown, ChevronUp } from 'lucide-react';
import ThreeDotsLoader from "@/components/ThreeDotsLoader";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    // Track expanded state for each message (default: collapsed for non-final)
    const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set());

    const toggleMessage = (index: number) => {
        setExpandedMessages(prev => {
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
            <div className="max-w-7xl mx-auto space-y-4">
                {messages.map((msg, index) => {
                    // Skip empty messages
                    if (!msg.content?.trim() && !msg.isLoading && !msg.toolData) {
                        return null;
                    }

                    const isExpanded = expandedMessages.has(index);
                    const isCollapsible = !msg.isFinalResponse && msg.sender === 'ai' && !msg.isLoading;
                    
                    // Check if this is a transfer message
                    const isTransferMessage = msg.content?.toLowerCase().includes('transfer');

                    // Render transfer messages as plain text
                    if (isTransferMessage && msg.sender === 'ai') {
                        return (
                            <div key={index} className="flex justify-center my-2 w-[70%]">
                                <span className="text-md  text-gray-500 dark:text-gray-400">
                                    {msg.content}
                                </span>
                            </div>
                        );
                    }

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
                                msg.sender === "user" ? "bg-black" : "bg-primary"
                            )}>
                                {msg.sender === "ai" && (
                                    <BotMessageSquare className="w-7 h-7 text-primary-foreground" />
                                )}
                            </div>

                            {/* Message Container */}
                            <div className="flex flex-col max-w-2xl gap-1 w-full">
                                {/* Agent Name Tag - Only show if expanded or not collapsible */}
                                {msg.sender === "ai" && (!isCollapsible || isExpanded) && (
                                    <span className={cn(
                                        "text-xs font-bold uppercase tracking-wider text-gray-400 px-1",
                                        msg.sender === "ai" ? "text-right" : "text-left"
                                    )}>
                                        {msg.name || "Assistant"}
                                    </span>
                                )}

                                <div
                                    className={cn(
                                        "rounded-2xl p-4 shadow-sm transition-all",
                                        msg.sender === "user"
                                            ? "bg-[#bdcbf2] text-slate-900 rounded-tl-none"
                                            : "bg-white dark:bg-gray-800 border text-slate-800 dark:text-slate-200 rounded-tr-none",
                                        index > 0 && messages[index - 1].sender === msg.sender ? "mt-1" : "mt-2",
                                        isCollapsible && !isExpanded && "cursor-pointer hover:shadow-md"
                                    )}
                                    onClick={() => isCollapsible && !isExpanded && toggleMessage(index)}
                                >
                                    {/* Collapsed View */}
                                    {isCollapsible && !isExpanded ? (
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                            <ChevronDown className="w-4 h-4" />
                                            <span className="font-semibold">{msg.name || "Agent"}</span>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Expand/Collapse Button for expanded collapsible messages */}
                                            {isCollapsible && isExpanded && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleMessage(index);
                                                    }}
                                                    className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mb-2 hover:text-gray-900 dark:hover:text-gray-100"
                                                >
                                                    <ChevronUp className="w-4 h-4" />
                                                </button>
                                            )}

                                            {msg.isLoading ? (
                                                <ThreeDotsLoader />
                                            ) : (
                                                <>
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                        components={{
                                                            p: ({ ...props }) => <p {...props} className="text-lg leading-relaxed mb-2" />,
                                                            h2: ({ ...props }) => <h2 {...props} className="text-xl font-bold mt-4 mb-2 border-b pb-1" />,
                                                            ul: ({ ...props }) => <ul {...props} className="list-disc ml-5 mb-2" />,
                                                            li: ({ ...props }) => <li {...props} className="text-lg mb-1" />,
                                                        }}
                                                    >
                                                        {msg.content}
                                                    </ReactMarkdown>

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