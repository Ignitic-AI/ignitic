import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ExternalLink, Star, ChevronDown, ChevronUp, FileText, ChevronRight, Globe, Link2, Settings, CheckCircle2, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import wlogo from "@/../public/white-logo.svg"
import dlogo from "@/../public/dark-logo.svg"
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { OrbitRing } from '@/components/orbit-ring';
import { TextShimmer } from '@/components/text-shimmer';

import { ToolResponseRegistry } from './Responses/index';

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

function isEmailAddress(text: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(text);
}

function isEmailUrl(href: string): boolean {
    return href.startsWith('mailto:') || isEmailAddress(href);
}

const MARKDOWN_CODE_FENCE_REGEX = /^\s*```[\s\S]*```\s*$/;
const HTML_TAG_REGEX = /<\/?[a-z][\w:-]*(?:\s[^<>]*)?>/i;

function looksLikeCodeLikeInput(content: string): boolean {
    const trimmed = content.trim();
    if (!trimmed || MARKDOWN_CODE_FENCE_REGEX.test(trimmed)) return false;

    if (HTML_TAG_REGEX.test(trimmed)) {
        return true;
    }

    // Heuristic for non-HTML code snippets (JS/TS/JSON/etc).
    const hasCodeKeywords = /\b(function|const|let|var|class|import|export|return)\b/.test(trimmed);
    const hasCodeSymbols = /[{}()[\];]/.test(trimmed);
    const hasMultipleLines = trimmed.includes('\n');
    return hasMultipleLines && hasCodeKeywords && hasCodeSymbols;
}

function toMarkdownCodeBlock(content: string): string {
    const trimmed = content.trim();
    if (!trimmed || MARKDOWN_CODE_FENCE_REGEX.test(trimmed)) return content;

    const language = HTML_TAG_REGEX.test(trimmed) ? 'html' : '';
    return `\`\`\`${language}\n${trimmed}\n\`\`\``;
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

    // Handle email links - render as simple mailto link, not as URL preview card
    if (isEmailUrl(href)) {
        const emailAddress = href.startsWith('mailto:') ? href.replace('mailto:', '') : href;
        return (
            <a href={`mailto:${emailAddress}`} className="text-blue-800 hover:underline font-semibold">
                {children || emailAddress}
            </a>
        );
    }

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
    text?: string;
    content?: string; // Fallback
    name?: string;
    agentName?: string; // from StreamingMessage
    isLoading?: boolean;
    isStreaming?: boolean; // from StreamingMessage
    isFinalResponse?: boolean;
    toolCalls: { name: string; args: any; status?: 'calling' | 'done' }[];
    hasThinking?: boolean;
    toolData?: unknown;
    toolName?: string;
    isToolDataMessage?: boolean;
    isTransferMessage?: boolean;
    image_urls?: string[];
    file_urls?: string[];
    systemStatus?: string | null;
    isAgentSpecificResponse?: boolean;
};

const TOOL_DATA_PREFIX_REGEX = /^ToolData:\s*/i;

function tryParseJson(value: string): unknown | null {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function normalizeToolDataInput(data: unknown): unknown | null {
    if (data === null || data === undefined) return null;

    if (typeof data !== 'string') {
        return data;
    }

    const cleaned = data.replace(TOOL_DATA_PREFIX_REGEX, '').trim();
    if (!cleaned) return null;

    const directParsed = tryParseJson(cleaned);
    if (directParsed !== null) return directParsed;

    // Support multiple JSON entries separated by newlines; prefer the latest valid payload.
    const lines = cleaned
        .split('\n')
        .map((line) => line.replace(TOOL_DATA_PREFIX_REGEX, '').trim())
        .filter(Boolean);

    for (let i = lines.length - 1; i >= 0; i--) {
        const parsed = tryParseJson(lines[i]);
        if (parsed !== null) return parsed;
    }

    // If the payload has extra text before JSON, attempt to extract JSON if it's embedded within text
    const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
        const slicedParsed = tryParseJson(jsonMatch[0]);
        if (slicedParsed !== null) return slicedParsed;
    }

    // Try a very permissive fallback: if the whole block has line breaks and seems to map to a custom text format, we could return it as text, but for now we only process JSON tool outputs
    // If we're here, it means we couldn't parse ANY JSON.
    // If the text looks like Zendesk output (contains specific Zendesk keywords), we can manually construct an object
    if (cleaned.includes("Status:") && cleaned.includes("Priority:")) {
        try {
            // Very hacky parser for the exact string format you provided
            const extractValue = (key: string, text: string) => {
                // Modified regex to look ahead for either the next known key OR the end of string.
                // It stops reading when it hits another capitalized word followed by a colon (e.g. "Status:", "Priority:", "Created At:")
                const regex = new RegExp(`${key}\\s*([\\s\\S]*?)(?=(?:\\s+[A-Za-z\\s]+:|\\s*$))`, 'i');
                const match = text.match(regex);
                return match ? match[1].trim() : '';
            };
            
            return {
                id: cleaned.match(/ticket ID (\d+)/i)?.[1] || "Unknown",
                subject: extractValue("Subject:", cleaned),
                description: extractValue("Description:", cleaned),
                status: extractValue("Status:", cleaned),
                priority: extractValue("Priority:", cleaned),
                assignee_id: extractValue("Assignee ID:", cleaned),
                created_at: extractValue("Created At:", cleaned),
                updated_at: extractValue("Updated At:", cleaned)
            };
        } catch {
            return cleaned; // Fallback to just returning the raw text if parsing fails
        }
    }

    // If all parsing fails, return the string itself instead of null so it can be rendered as text!
    return cleaned;
}

function hasRenderableToolData(data: unknown): boolean {
    const normalized = normalizeToolDataInput(data);
    if (normalized === null || normalized === undefined) return false;
    if (typeof normalized === 'string') return normalized.trim().length > 0;
    if (Array.isArray(normalized)) return normalized.length > 0;
    return true;
}

// Extracts the target agent from a LangGraph Command string
function parseTransferCommand(data: unknown): string | null {
    if (typeof data !== 'string') return null;
    
    // Looking for goto='agent_name'
    const gotoMatch = data.match(/goto='([^']+)'/);
    if (gotoMatch) return gotoMatch[1];
    
    // Fallback: looking for 'active_agent': 'agent_name'
    const activeAgentMatch = data.match(/'active_agent':\s*'([^']+)'/);
    if (activeAgentMatch) return activeAgentMatch[1];
    
    return null;
}

// Helper component to render tool data
function ToolDataBlock({ data, isLoading, msg }: { data: unknown; isLoading: boolean; msg: ChatMessage }) {
    const parsed = normalizeToolDataInput(data);

    if (parsed === null) {
        return null;
    }

    // --- Metadata Extraction (Handles both WebSocket stream and REST API formats) ---
    // 1. Agent Name: 
    //    WebSocket provides `msg.agentName`. REST API usually maps agent name to `msg.name` (for AIMessage).
    let agentName = 'Agent';
    if (msg.agentName) {
        agentName = msg.agentName;
    } else if (msg.name && !msg.isToolDataMessage && !msg.toolCalls?.length) {
        // If it's a message containing tool data but not explicitly marked as a ToolMessage, 
        // the 'name' field on AIMessage usually denotes the Agent.
        agentName = msg.name;
    }

    // 2. Tool Name:
    //    WebSocket & REST: if toolCalls array exists, use the first tool call's name.
    //    REST ToolMessage: msg.isToolDataMessage is true, and msg.name is the tool name.
    let toolName = '';
    if (msg.toolName) {
        toolName = msg.toolName;
    } else if (msg.toolCalls && msg.toolCalls.length > 0) {
        toolName = msg.toolCalls[0].name;
    } else if (msg.isToolDataMessage && msg.name) {
        toolName = msg.name;
    } else if (msg.name && !msg.agentName) {
        // Fallback for unstructured responses where toolName was injected into msg.name
        toolName = msg.name;
    }
    // ----------------------------------------------------------------------------------

    const toolNameLower = toolName.toLowerCase().trim();

    // --- Handle Agent Transfers ---
    if (toolNameLower.startsWith('transfer_to_')) {
        const transferTarget = parseTransferCommand(data) || toolName.replace(/^transfer_to_/i, '');
        
        return (
            <div className="mb-3 mt-1 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20 px-3 py-2.5 rounded-lg border border-blue-100 dark:border-blue-900/50 w-fit" onClick={(e) => e.stopPropagation()}>
                <CheckCircle2 className="w-4 h-4 text-blue-500" />
                <span>
                    Successfully transferred to <strong className="capitalize">{transferTarget.replace('_agent', '').replace('_', ' ')}</strong> agent
                </span>
            </div>
        );
    }
    // -----------------------------------

    const parsedObj = parsed as any;
    const matchedConfig = ToolResponseRegistry[toolNameLower];

    if (matchedConfig) {
        const { component: Component, parser, extractProps } = matchedConfig as any;
        
        // Use the parser if it exists to handle raw or partially parsed data, 
        // otherwise fallback to extractProps (with parsedObject), 
        // and finally raw data fallback
        let props;
        if (parser) {
            props = parser(data || parsedObj);
        } else if (extractProps) {
            props = extractProps(parsedObj);
        } else {
            props = { rawData: data || parsedObj };
        }

        return (
            <div className="mb-3 w-full" onClick={(e) => e.stopPropagation()}>
                <Component {...props} />
            </div>
        );
    }

    // Only render tool output when tool name is explicitly registered.
    return null;
}

const ThinkingBlock = ({ content, isThinking }: { content: string, isThinking: boolean }) => {
    const [isOpen, setIsOpen] = useState(false);
    const previousThinkingRef = useRef(isThinking);
    
    // Auto open when thinking, close when done (if user hasn't toggled)
    const isActuallyOpen = isThinking || isOpen;

    // When thinking ends, collapse the block so it switches to a compact "Thought Process" view.
    useEffect(() => {
        if (previousThinkingRef.current && !isThinking) {
            setIsOpen(false);
        }
        previousThinkingRef.current = isThinking;
    }, [isThinking]);
    
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
                {isThinking ? "Thinking..." : "Thought Process"}
            </button>
            {isActuallyOpen && (
                <div 
                    className="mt-2 text-sm text-slate-600 dark:text-slate-300 bg-white/40 dark:bg-black/10 rounded-lg p-3 border border-slate-200 dark:border-slate-800/50"
                    onClick={(e) => e.stopPropagation()}
                >
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            p: ({ ...props }) => <p {...props} className="mb-2 last:mb-0 break-words" />,
                            pre: ({ className, ...props }: any) => (
                                <pre
                                    {...props}
                                    className={cn(
                                        "my-2 max-w-full overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-900 px-3 py-2",
                                        className
                                    )}
                                />
                            ),
                            code: ({ inline, className, ...props }: any) => (
                                <code
                                    {...props}
                                    className={cn(
                                        inline
                                            ? "rounded bg-slate-200/70 dark:bg-slate-800 px-1 py-0.5 break-all whitespace-pre-wrap"
                                            : "font-mono text-sm whitespace-pre",
                                        className
                                    )}
                                />
                            ),
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

function ToolCallsBlock({ toolCalls }: { toolCalls: ChatMessage['toolCalls'] }) {
    if (!toolCalls || toolCalls.length === 0) return null;
    return (
        <div className="flex flex-col gap-2 mb-3">
            {toolCalls.map((tc, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-500 bg-white/50 dark:bg-black/20 px-3 py-1.5 rounded-full w-fit border border-slate-200 dark:border-slate-700/50 shadow-sm">
                    {tc.status === 'calling' ? (
                        <Settings className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    )}
                    <span className="font-medium">
                        {tc.status === 'calling' ? `Using ${tc.name}...` : `${tc.name} done`}
                    </span>
                </div>
            ))}
        </div>
    );
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
        <div className="flex-1 p-4 overflow-y-auto overflow-x-hidden dark:bg-bg-light bg-bg-lm">
            <div className="max-w-5xl mx-auto space-y-1 pr-0 lg:pr-32">
                {(() => { 
                    let lastRenderedSender: string | null = null; 

                    return messages.map((msg, index) => {

                    let displayContent = msg.text || msg.content || "";

                    // 1. Remove <injected_context> blocks (even if streaming and not yet closed)
                    displayContent = displayContent.replace(/<injected_context>[\s\S]*?(?:<\/injected_context>|$)/g, "").trim();

                    const contentForRendering =
                        msg.sender === "user" && looksLikeCodeLikeInput(displayContent)
                            ? toMarkdownCodeBlock(displayContent)
                            : displayContent;

                    const effectiveIsLoading = !!msg.isStreaming || !!msg.isLoading;
                    const hasToolOutput = hasRenderableToolData(msg.toolData);

                    // Skip empty messages only if they are not loading and have no content, no tools, no systemStatus
                    if (!displayContent && !effectiveIsLoading && !msg.toolData && (!msg.toolCalls || msg.toolCalls.length === 0) && !msg.systemStatus) {
                        return null; // don't update lastRenderedSender for skipped messages
                    }

                    const isExpanded = !collapsedMessages.has(index);
                    // Allow collapsing if it's an AI message (only after loading is complete)
                    const isCollapsible = msg.sender === 'ai' && !effectiveIsLoading && !msg.isFinalResponse && !msg.isToolDataMessage && !msg.isTransferMessage;

                    // Only show avatar on the first message of a consecutive *rendered* group
                    const isFirstInGroup = lastRenderedSender !== msg.sender;
                    lastRenderedSender = msg.sender;
                    
                    return (
                        <div
                            key={index}
                            className={cn(
                                "flex items-start gap-3",
                                msg.sender === "user" ? "flex-row-reverse" : "flex-row"
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
                            <div className="flex flex-col gap-1 min-w-0 max-w-full">
                                <div
                                    className={cn(
                                        "rounded-xl px-4 py-2 transition-all inline-block min-w-0 max-w-full sm:max-w-2xl",
                                        msg.sender === "user"
                                            ? "shadow-sm bg-[#bdcbf2] dark:bg-chatBg text-slate-900 dark:text-white rounded-tr-none"
                                            : "bg-transparent text-slate-800 dark:text-slate-200 rounded-tl-none px-0",
                                        index > 0 && messages[index - 1].sender === msg.sender ? "mt-1" : "mt-2",
                                        isCollapsible && !isExpanded && "cursor-pointer hover:shadow-md"
                                    )}
                                    onClick={() => isCollapsible && !isExpanded && toggleMessage(index)}
                                >
                                    {/* Agent Name Tag - Inside Bubble */}
                                    {msg.sender === "ai" && !msg.isToolDataMessage && (!isCollapsible || isExpanded) && (
                                        <div className={cn(
                                            "flex items-center gap-2 mb-1 justify-start"
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
                                            {effectiveIsLoading ? (
                                                <TextShimmer
                                                    as="span"
                                                    className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400"
                                                    duration={1.7}
                                                >
                                                    {msg.agentName || msg.name || "Assistant"}
                                                </TextShimmer>
                                            ) : (
                                                <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                                                    {msg.agentName || msg.name || "Assistant"}
                                                </span>
                                            )}
                                            
                                        </div>
                                    )}

                                    {/* Collapsed View */}
                                    {isCollapsible && !isExpanded ? (
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                            <ChevronDown className="w-4 h-4" />
                                            <span className="font-semibold">{msg.agentName || msg.name || "Agent"}</span>
                                        </div>
                                    ) : (
                                        <>

                                            {/* System Status (e.g. Summarizing) */}
                                            {msg.systemStatus && (
                                                <div className="flex items-center gap-2 text-xs text-slate-500 mb-2 p-1">
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    <span className="italic">{msg.systemStatus}</span>
                                                </div>
                                            )}

                                            {/* Tool Calls Block */}
                                            {msg.toolCalls && msg.toolCalls.length > 0 && (!msg.isToolDataMessage || hasToolOutput) && (
                                                <ToolCallsBlock toolCalls={msg.toolCalls} />
                                            )}

                                            {/* Show loader only if loading AND no content yet AND no tools/systemStatus */}
                                            {effectiveIsLoading && !displayContent && (!msg.toolCalls || msg.toolCalls.length === 0) && !msg.systemStatus ? (
                                                <div className='p-2'>
                                                    <OrbitRing className="h-6 w-6 text-primary-lm dark:text-primary" />
                                                </div>
                                                
                                            ) : (
                                                <>
                                                    {contentForRendering && (
                                                        <div className="max-w-full break-words">
                                                            <ReactMarkdown
                                                                remarkPlugins={[remarkGfm]}
                                                                components={{
                                                                    p: ({ ...props }) => <p {...props} className="text-base leading-relaxed mb-2 break-words" />,
                                                                    h2: ({ ...props }) => <h2 {...props} className="text-lg font-bold mt-4 mb-2 border-b pb-1 break-words" />,
                                                                    ul: ({ ...props }) => <ul {...props} className="list-disc ml-5 mb-2 break-words" />,
                                                                    li: ({ ...props }) => <li {...props} className="text-base mb-1 break-words" />,
                                                                    pre: ({ className, ...props }: any) => (
                                                                        <pre
                                                                            {...props}
                                                                            className={cn(
                                                                                "my-2 max-w-full overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-900 px-3 py-2",
                                                                                className
                                                                            )}
                                                                        />
                                                                    ),
                                                                    code: ({ inline, className, ...props }: any) => (
                                                                        <code
                                                                            {...props}
                                                                            className={cn(
                                                                                inline
                                                                                    ? "rounded bg-slate-200/70 dark:bg-slate-800 px-1 py-0.5 break-all whitespace-pre-wrap"
                                                                                    : "font-mono text-sm whitespace-pre",
                                                                                className
                                                                            )}
                                                                        />
                                                                    ),
                                                                    a: markdownLinkRenderer,
                                                                }}
                                                            >
                                                                {contentForRendering}
                                                            </ReactMarkdown>
                                                        </div>
                                                    )}

                                                    {/* Streaming indicator */}
                                                    {effectiveIsLoading && !msg.toolData && !msg.isTransferMessage && (
                                                        <span className="inline-block w-2 h-4 ml-1 bg-gray-400 animate-pulse align-middle" />
                                                    )}

                                                    {/* Render Tool Data only for tool-specific messages */}
                                                    {msg.isToolDataMessage && hasToolOutput && <ToolDataBlock data={msg.toolData} isLoading={!!msg.isLoading} msg={msg} />}
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Render User Images + Files horizontally in one row */}
                                {msg.sender === "user" && ((msg.image_urls && msg.image_urls.length > 0) || (msg.file_urls && msg.file_urls.length > 0)) && (
                                    <div className="flex flex-row flex-wrap gap-2 mt-1 justify-end">
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
