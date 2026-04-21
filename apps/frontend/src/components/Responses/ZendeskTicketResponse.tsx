import React from 'react';
import { ExternalLink, Tag, MessageSquare, Clock, User } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"

export function ZendeskTicketResponse({ tickets }: { tickets: any }) {
    console.log("[ZendeskTicketResponse] Rendering Zendesk tickets block", tickets);
    if (!tickets) return null;
    
    // Normalize data: could be an array, a single object, or nested under 'ticket'/'tickets'
    let ticketArray = [];
    if (Array.isArray(tickets)) {
        ticketArray = tickets;
    } else if (tickets.tickets && Array.isArray(tickets.tickets)) {
        ticketArray = tickets.tickets;
    } else if (tickets.ticket) {
        ticketArray = [tickets.ticket];
    } else {
        ticketArray = [tickets];
    }

    if (ticketArray.length === 0) return null;

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'open': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
            case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
            case 'solved': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
            case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority?.toLowerCase()) {
            case 'low': return 'text-gray-500';
            case 'normal': return 'text-blue-500';
            case 'high': return 'text-orange-500';
            case 'urgent': return 'text-red-500';
            default: return 'text-gray-500';
        }
    };

    return (
        <div className="flex flex-col gap-3 mt-3 font-generalSans w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            {ticketArray.map((ticket: any, i: number) => {
                const date = ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : 'Unknown Date';
                
                return (
                    <Sheet key={ticket.id || i}>
                        <SheetTrigger asChild>
                            <div className="flex flex-col bg-bg-lm dark:bg-bg rounded-[4px] border border-border-lm dark:border-border p-4 hover:shadow-md transition-all cursor-pointer">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs text-text-muted-lm dark:text-text-muted">#{ticket.id}</span>
                                        <Badge variant="outline" className={`capitalize border-transparent ${getStatusColor(ticket.status)}`}>
                                            {ticket.status || 'Unknown'}
                                        </Badge>
                                        {ticket.priority && (
                                            <span className={`text-xs font-semibold capitalize ${getPriorityColor(ticket.priority)}`}>
                                                {ticket.priority} Priority
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-text-muted-lm dark:text-text-muted flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {date}
                                    </div>
                                </div>
                                
                                <h3 className="text-base font-semibold text-text-lm dark:text-text line-clamp-1 mb-2">
                                    {ticket.subject || 'No Subject'}
                                </h3>
                                
                                <p className="text-sm text-text-muted-lm dark:text-text-muted line-clamp-2 mb-3">
                                    {ticket.description || 'No description available.'}
                                </p>
                                
                                <div className="flex items-center gap-4 mt-auto pt-2 border-t border-border-lm/50 dark:border-border/50">
                                    <div className="flex items-center gap-1 text-xs text-text-muted-lm dark:text-text-muted">
                                        <User className="w-3 h-3" />
                                        Requester: {ticket.requester_id || 'Unknown'}
                                    </div>
                                    {ticket.tags && ticket.tags.length > 0 && (
                                        <div className="flex items-center gap-1 text-xs text-text-muted-lm dark:text-text-muted">
                                            <Tag className="w-3 h-3" />
                                            {ticket.tags.length} tags
                                        </div>
                                    )}
                                </div>
                            </div>
                        </SheetTrigger>

                        {/* SHEET CONTENT */}
                        <SheetContent side="right" className="w-[90vw] sm:max-w-xl lg:max-w-2xl p-0 font-generalSans bg-bg-lm dark:bg-bg border-l border-border-lm dark:border-border flex flex-col rounded-l-[4px]">
                            <SheetHeader className="px-6 py-4 border-b border-border-lm dark:border-border shrink-0">
                                <div className="flex items-center justify-between">
                                    <SheetTitle className="text-lg font-bold text-text-lm dark:text-text flex items-center gap-2">
                                        Ticket #{ticket.id}
                                    </SheetTitle>
                                    <a href={ticket.url?.replace('.json', '') || '#'} target="_blank" rel="noopener noreferrer" className="text-primary-lm dark:text-primary hover:underline flex items-center text-sm">
                                        View in Zendesk <ExternalLink className="w-4 h-4 ml-1" />
                                    </a>
                                </div>
                            </SheetHeader>
                            
                            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide space-y-6">
                                {/* Header Info */}
                                <div>
                                    <h2 className="text-xl font-bold text-text-lm dark:text-text mb-4">
                                        {ticket.subject}
                                    </h2>
                                    <div className="flex flex-wrap gap-3 mb-6">
                                        <Badge variant="outline" className={`capitalize ${getStatusColor(ticket.status)} border-transparent`}>
                                            Status: {ticket.status || 'Unknown'}
                                        </Badge>
                                        <Badge variant="outline" className={`capitalize border-border-lm dark:border-border ${getPriorityColor(ticket.priority)}`}>
                                            Priority: {ticket.priority || 'Unknown'}
                                        </Badge>
                                        <Badge variant="outline" className="capitalize border-border-lm dark:border-border text-text-muted-lm dark:text-text-muted">
                                            Type: {ticket.type || 'Unknown'}
                                        </Badge>
                                    </div>
                                </div>

                                {/* Description */}
                                <div className="bg-bg-light-lm dark:bg-bg-light p-4 rounded-lg border border-border-lm dark:border-border">
                                    <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-text-lm dark:text-text">
                                        <MessageSquare className="w-4 h-4" />
                                        Description
                                    </div>
                                    <div className="text-sm text-text-lm dark:text-text whitespace-pre-wrap font-mono">
                                        {ticket.description}
                                    </div>
                                </div>

                                {/* Details Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <div className="text-xs text-text-muted-lm dark:text-text-muted font-semibold uppercase tracking-wider">Requester ID</div>
                                        <div className="text-sm text-text-lm dark:text-text">{ticket.requester_id || 'N/A'}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-xs text-text-muted-lm dark:text-text-muted font-semibold uppercase tracking-wider">Assignee ID</div>
                                        <div className="text-sm text-text-lm dark:text-text">{ticket.assignee_id || 'Unassigned'}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-xs text-text-muted-lm dark:text-text-muted font-semibold uppercase tracking-wider">Created</div>
                                        <div className="text-sm text-text-lm dark:text-text">{new Date(ticket.created_at).toLocaleString()}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-xs text-text-muted-lm dark:text-text-muted font-semibold uppercase tracking-wider">Updated</div>
                                        <div className="text-sm text-text-lm dark:text-text">{new Date(ticket.updated_at).toLocaleString()}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-xs text-text-muted-lm dark:text-text-muted font-semibold uppercase tracking-wider">Channel</div>
                                        <div className="text-sm text-text-lm dark:text-text capitalize">{ticket.via?.channel || 'Unknown'}</div>
                                    </div>
                                </div>

                                {/* Tags */}
                                {ticket.tags && ticket.tags.length > 0 && (
                                    <div>
                                        <div className="text-xs text-text-muted-lm dark:text-text-muted font-semibold uppercase tracking-wider mb-2">Tags</div>
                                        <div className="flex flex-wrap gap-2">
                                            {ticket.tags.map((tag: string) => (
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
                );
            })}
        </div>
    );
}

export default ZendeskTicketResponse;
