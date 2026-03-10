import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ExternalLink, Star, ChevronDown, ChevronUp, FileText, ChevronRight, Globe, Link2 } from 'lucide-react';
import { Spinner } from "@/components/ui/spinner";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import wlogo from "@/../public/white-logo.svg"
import dlogo from "@/../public/dark-logo.svg"
import Image from 'next/image';

// --- URL Preview Helpers ---
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|avif)(\?.*)?$/i;

function isImageUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return IMAGE_EXTENSIONS.test(parsed.pathname);
    } catch {
        return IMAGE_EXTENSIONS.test(url);
    }
}

function getDomain(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
}

function getFaviconUrl(url: string): string {
    try {
        const hostname = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
    } catch {
        return '';
    }
}

function getDomainColor(domain: string): string {
    if (domain.includes('amazon')) return 'border-orange-400/40 bg-orange-50 dark:bg-orange-950/30';
    if (domain.includes('github')) return 'border-gray-400/40 bg-gray-50 dark:bg-gray-900/30';
    if (domain.includes('youtube')) return 'border-red-400/40 bg-red-50 dark:bg-red-950/30';
    if (domain.includes('google')) return 'border-blue-400/40 bg-blue-50 dark:bg-blue-950/30';
    if (domain.includes('shopify')) return 'border-green-400/40 bg-green-50 dark:bg-green-950/30';
    return 'border-slate-300/50 bg-slate-50 dark:bg-slate-800/40';
}

// Image preview for image URLs
function ImagePreview({ src, alt }: { src: string; alt?: string }) {
    const [errored, setErrored] = useState(false);
    if (errored) {
        return (
            <a href={src} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline inline-flex items-center gap-1">
                <Link2 className="w-3.5 h-3.5" />{alt || src}
            </a>
        );
    }
    return (
        <a href={src} target="_blank" rel="noopener noreferrer" className="block my-2 group">
            <img
                src={src}
                alt={alt || 'Image'}
                onError={() => setErrored(true)}
                className="max-h-72 max-w-full rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm object-contain transition-transform group-hover:scale-[1.01]"
            />
        </a>
    );
}

// Rich link preview card for non-image URLs
function LinkPreviewCard({ href, children }: { href: string; children: React.ReactNode }) {
    const domain = getDomain(href);
    const favicon = getFaviconUrl(href);
    const colorClasses = getDomainColor(domain);

    // Determine a display title from children
    const childText = typeof children === 'string'
        ? children
        : React.Children.toArray(children).map(c => (typeof c === 'string' ? c : '')).join('');
    const displayTitle = childText && childText !== href ? childText : '';

    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                "flex items-center gap-3 my-1.5 px-3 py-2.5 rounded-lg border transition-all",
                "hover:shadow-md hover:scale-[1.005] active:scale-[0.998]",
                colorClasses
            )}
        >
            {favicon ? (
                <img src={favicon} alt="" className="w-5 h-5 rounded-sm shrink-0" />
            ) : (
                <Globe className="w-5 h-5 text-slate-400 shrink-0" />
            )}
            <span className="flex flex-col min-w-0 flex-1">
                {displayTitle && (
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                        {displayTitle}
                    </span>
                )}
                <span className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    {domain}
                </span>
            </span>
        </a>
    );
}

// Custom 'a' renderer for ReactMarkdown
const markdownLinkRenderer = ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children?: React.ReactNode }) => {
    if (!href) return <a {...props}>{children}</a>;

    // If link points to an image, show image preview
    if (isImageUrl(href)) {
        return <ImagePreview src={href} alt={typeof children === 'string' ? children : undefined} />;
    }

    // Otherwise show a rich link card
    return <LinkPreviewCard href={href}>{children}</LinkPreviewCard>;
};

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
    image_urls?: string[];
    file_urls?: string[];
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

const ThinkingBlock = ({ content, isLoading }: { content: string, isLoading: boolean }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    // Auto open when loading, close when not loading (if user hasn't toggled)
    const isActuallyOpen = isLoading || isOpen;
    
    return (
        <div className="mb-3">
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors font-medium border border-slate-200 dark:border-slate-700/50 rounded-full px-3 py-1 bg-white/50 dark:bg-black/20"
            >
                {isActuallyOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                {isLoading ? "Thinking..." : "Thought Process"}
            </button>
            {isActuallyOpen && (
                <div 
                    className="mt-2 text-sm text-slate-600 dark:text-slate-300 bg-white/40 dark:bg-black/10 rounded-lg p-3 border border-slate-200 dark:border-slate-800/50"
                    onClick={(e) => e.stopPropagation()}
                >
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            p: ({ ...props }) => <p {...props} className="mb-2 last:mb-0" />,
                            a: markdownLinkRenderer,
                        }}
                    >
                        {content}
                    </ReactMarkdown>
                </div>
            )}
        </div>
    );
};

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
                {(() => { let lastRenderedSender: string | null = null; return messages.map((msg, index) => {
                    let displayContent = msg.content || "";

                    // 1. Remove <injected_context> blocks (even if streaming and not yet closed)
                    displayContent = displayContent.replace(/<injected_context>[\s\S]*?(?:<\/injected_context>|$)/g, "").trim();

                    // 2. Extract thinking block
                    let thinkingContent = "";
                    const transferRegex = /\[Transferring to .*?\][\s\S]*?(?:\bAct\b|$)/i;
                    const transferMatch = displayContent.match(transferRegex);

                    if (transferMatch) {
                        thinkingContent = transferMatch[0];
                        displayContent = displayContent.replace(transferRegex, "").trim();
                        // remove "Act" from the end of thinking content
                        thinkingContent = thinkingContent.replace(/\bAct\b\s*$/i, "").trim();
                    }

                    // 3. Strip standalone "Act" that may remain as the entire content
                    displayContent = displayContent.replace(/^\s*Act\s*$/i, "").trim();

                    // Skip empty messages only if they are not loading and have no content
                    if (!displayContent && !thinkingContent && !msg.isLoading && !msg.toolData) {
                        return null; // don't update lastRenderedSender for skipped messages
                    }

                    const isExpanded = !collapsedMessages.has(index);
                    // Allow collapsing if it's an AI message (only after loading is complete)
                    const isCollapsible = msg.sender === 'ai' && !msg.isLoading && !msg.isFinalResponse;

                    // Only show avatar on the first message of a consecutive *rendered* group
                    const isFirstInGroup = lastRenderedSender !== msg.sender;
                    lastRenderedSender = msg.sender;
                    
                    return (
                        <div
                            key={index}
                            className={cn(
                                "flex items-start gap-3",
                                msg.sender === "user" ? "flex-row" : "flex-row-reverse"
                            )}
                        >
                            {/* Avatar Logic — only show on first message of a consecutive group */}
                            {isFirstInGroup ? (
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
                            ) : (
                                <div className="w-12 shrink-0" />
                            )}

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
                                            {msg.isLoading && !displayContent && !thinkingContent ? (
                                                <div className='p-2'>
<Spinner />
                                                </div>
                                                
                                            ) : (
                                                <>
                                                    {thinkingContent && (
                                                        <ThinkingBlock content={thinkingContent} isLoading={!!msg.isLoading} />
                                                    )}
                                                    
                                                    {displayContent && (
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm]}
                                                            components={{
                                                                p: ({ ...props }) => <p {...props} className="text-base leading-relaxed mb-2" />,
                                                                h2: ({ ...props }) => <h2 {...props} className="text-lg font-bold mt-4 mb-2 border-b pb-1" />,
                                                                ul: ({ ...props }) => <ul {...props} className="list-disc ml-5 mb-2" />,
                                                                li: ({ ...props }) => <li {...props} className="text-base mb-1" />,
                                                                a: markdownLinkRenderer,
                                                            }}
                                                        >
                                                            {displayContent}
                                                        </ReactMarkdown>
                                                    )}

                                                    {/* Streaming indicator */}
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

                                {/* Render User Images + Files horizontally in one row */}
                                {msg.sender === "user" && ((msg.image_urls && msg.image_urls.length > 0) || (msg.file_urls && msg.file_urls.length > 0)) && (
                                    <div className="flex flex-row flex-wrap gap-2 mt-1">
                                        {msg.image_urls?.map((url, i) => (
                                            <div key={`img-${i}`} className="relative w-24 h-24 rounded-lg overflow-hidden border border-border/50 shadow-sm opacity-90 transition-opacity hover:opacity-100">
                                                <img
                                                    src={url}
                                                    alt={`Uploaded ${i}`}
                                                    className="object-cover w-full h-full"
                                                />
                                            </div>
                                        ))}
                                        {msg.file_urls?.map((url: string, i: number) => {
                                            const filename = url.split('/').pop() || 'Document';
                                            return (
                                            <a 
                                                key={`file-${i}`} 
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="relative w-24 h-24 rounded-lg overflow-hidden border border-border/50 bg-zinc-100 dark:bg-zinc-800 flex flex-col items-center justify-center text-center shadow-sm opacity-90 transition-opacity hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                            >
                                                <FileText className="w-8 h-8 text-zinc-500 mb-2" />
                                                <span className="text-[10px] text-zinc-600 dark:text-zinc-400 w-20 px-1 line-clamp-2 break-all" title={filename}>
                                                    {filename}
                                                </span>
                                            </a>
                                        )})}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                }); })()}
            </div>
        </div>
    );
}

export default ChatDisplay;