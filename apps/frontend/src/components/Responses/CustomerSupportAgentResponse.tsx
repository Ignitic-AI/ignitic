import React from 'react';
import { ExternalLink, Tag, MessageSquare, Clock, User, Send } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { cn } from '@/lib/utils';

export function CustomerSupportAgentResponse({ content, agentName = 'Customer Support Agent' }: { content: string; agentName?: string }) {
    console.log("[CustomerSupportAgentResponse] Rendering agent response", content);
    if (!content) return null;

    const extractValue = (key: string, text: string): string => {
        const regex = new RegExp(`${key}\\s*([\\s\\S]*?)(?=(?:\\s+[A-Za-z\\s]+:|\\s*$))`, 'i');
        const match = text.match(regex);
        return match ? match[1].trim() : '';
    };

    const ticketId = content.match(/ticket ID (\d+)/i)?.[1] || "New";
    const subject = extractValue("Subject:", content) || "No Subject";
    const description = extractValue("Description:", content) || content;
    const status = extractValue("Status:", content) || "open";
    const priority = extractValue("Priority:", content) || "normal";
    const requesterId = extractValue("Requester:", content) || extractValue("Requester ID:", content) || "Unknown";
    const assigneeId = extractValue("Assignee:", content) || extractValue("Assignee ID:", content) || "Unassigned";
    const createdAt = extractValue("Created At:", content) || new Date().toISOString();
    const tags = content.match(/Tags: (.*)/i)?.[1]?.split(',').map(t => t.trim()) || [];

    const getStatusColor = (s: string) => {
        switch (s?.toLowerCase()) {
            case 'open': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
            case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
            case 'solved': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
            case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
        }
    };

    const getPriorityColor = (p: string) => {
        switch (p?.toLowerCase()) {
            case 'low': return 'text-gray-500';
            case 'normal': return 'text-blue-500';
            case 'high': return 'text-orange-500';
            case 'urgent': return 'text-red-500';
            default: return 'text-gray-500';
        }
    };

    const date = new Date(createdAt).toLocaleDateString();

    return (
        <div className="flex flex-col gap-3 mt-3 font-generalSans w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <Sheet>
                <SheetTrigger asChild>
                    <div className="flex flex-col bg-bg-lm dark:bg-bg rounded-[4px] border border-border-lm dark:border-border p-4 hover:shadow-md transition-all cursor-pointer overflow-hidden break-words">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-text-muted-lm dark:text-text-muted">#{ticketId}</span>
                                <Badge variant="outline" className={cn("capitalize border-transparent", getStatusColor(status))}>
                                    {status || 'Unknown'}
                                </Badge>
                                {priority && (
                                    <span className={cn("text-xs font-semibold capitalize", getPriorityColor(priority))}>
                                        {priority} Priority
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                <Send className="w-3 h-3 text-text-muted-lm dark:text-text-muted" />
                                <span className="text-[10px] text-text-muted-lm dark:text-text-muted uppercase">
                                    {agentName}
                                </span>
                            </div>
                        </div>
                        
                        <h3 className="text-base font-semibold text-text-lm dark:text-text line-clamp-1 mb-2 break-words">
                            {subject}
                        </h3>
                        
                        <p className="text-sm text-text-muted-lm dark:text-text-muted line-clamp-2 mb-3 break-words">
                            {description.substring(0, 150).replace(/\n/g, ' ')}{description.length > 150 ? '...' : ''}
                        </p>
                        
                        <div className="flex items-center gap-4 mt-auto pt-2 border-t border-border-lm/50 dark:border-border/50">
                            <div className="flex items-center gap-1 text-xs text-text-muted-lm dark:text-text-muted">
                                <User className="w-3 h-3" />
                                Requester: {requesterId}
                            </div>
                            {tags.length > 0 && (
                                <div className="flex items-center gap-1 text-xs text-text-muted-lm dark:text-text-muted">
                                    <Tag className="w-3 h-3" />
                                    {tags.length} tags
                                </div>
                            )}
                        </div>
                    </div>
                </SheetTrigger>

                <SheetContent side="right" className="w-[90vw] sm:max-w-xl lg:max-w-2xl p-0 font-generalSans bg-bg-lm dark:bg-bg border-l border-border-lm dark:border-border flex flex-col rounded-l-[4px]">
                    <SheetHeader className="px-6 py-4 border-b border-border-lm dark:border-border shrink-0">
                        <div className="flex items-center justify-between">
                            <SheetTitle className="text-lg font-bold text-text-lm dark:text-text flex items-center gap-2">
                                Ticket #{ticketId}
                            </SheetTitle>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className={cn("capitalize", getStatusColor(status))}>
                                    Status: {status}
                                </Badge>
                                <Badge variant="outline" className={cn("capitalize border-border-lm dark:border-border", getPriorityColor(priority))}>
                                    Priority: {priority}
                                </Badge>
                            </div>
                        </div>
                    </SheetHeader>
                    
                    <div className="flex-1 overflow-y-auto p-6 scrollbar-hide space-y-6 overflow-hidden break-words">
                        <div>
                            <h2 className="text-xl font-bold text-text-lm dark:text-text mb-4">
                                {subject}
                            </h2>
                        </div>

                        <div className="bg-bg-light-lm dark:bg-bg-light p-4 rounded-lg border border-border-lm dark:border-border">
                            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-text-lm dark:text-text">
                                <MessageSquare className="w-4 h-4" />
                                Description
                            </div>
                            <div className="text-sm text-text-lm dark:text-text whitespace-pre-wrap">
                                {description}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <div className="text-xs text-text-muted-lm dark:text-text-muted font-semibold uppercase tracking-wider">Requester ID</div>
                                <div className="text-sm text-text-lm dark:text-text">{requesterId}</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-xs text-text-muted-lm dark:text-text-muted font-semibold uppercase tracking-wider">Assignee ID</div>
                                <div className="text-sm text-text-lm dark:text-text">{assigneeId}</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-xs text-text-muted-lm dark:text-text-muted font-semibold uppercase tracking-wider">Created</div>
                                <div className="text-sm text-text-lm dark:text-text">{new Date(createdAt).toLocaleString()}</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-xs text-text-muted-lm dark:text-text-muted font-semibold uppercase tracking-wider">Channel</div>
                                <div className="text-sm text-text-lm dark:text-text capitalize">email</div>
                            </div>
                        </div>

                        {tags.length > 0 && (
                            <div>
                                <div className="text-xs text-text-muted-lm dark:text-text-muted font-semibold uppercase tracking-wider mb-2">Tags</div>
                                <div className="flex flex-wrap gap-2">
                                    {tags.map((tag: string) => (
                                        <Badge key={tag} variant="secondary" className="bg-bg-light-lm dark:bg-bg-light text-text-muted-lm dark:text-text-muted border border-border-lm dark:border-border">
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}

export default CustomerSupportAgentResponse;