import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ZendeskTicket {
    id: number;
    subject: string;
    description: string;
    status: string;
    priority: string;
    created_at: string;
    url: string;
}

export function ZendeskTicketsResponse({ tickets }: { tickets: ZendeskTicket[] }) {
    if (!Array.isArray(tickets) || tickets.length === 0) return null;

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'open':
                return 'bg-danger-lm/15 text-danger-lm dark:bg-danger/25 dark:text-danger';
            case 'pending':
                return 'bg-warning-lm/15 text-warning-lm dark:bg-warning/25 dark:text-warning';
            case 'solved':
                return 'bg-success-lm/15 text-success-lm dark:bg-success/25 dark:text-success';
            case 'closed':
                return 'bg-bg-lm text-text-muted-lm dark:bg-bg dark:text-text-muted';
            default:
                return 'bg-info-lm/15 text-info-lm dark:bg-info/25 dark:text-info';
        }
    };

    return (
        <div className="space-y-4 mt-4 font-generalSans" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black text-text-muted-lm dark:text-text-muted uppercase tracking-widest">
                    Zendesk Support Tickets
                </span>
                <Badge variant="outline" className="text-[9px] border-border-lm dark:border-border text-text-muted-lm dark:text-text-muted font-bold">
                    {tickets.length} TOTAL
                </Badge>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {tickets.map((ticket) => {
                    const date = new Date(ticket.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    });

                    const displaySubject = ticket.subject.replace('SAMPLE: ', '');

                    return (
                        <div key={ticket.id} className="bg-bg-light-lm dark:bg-bg-light border border-border-lm dark:border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                            <div className="p-4">
                                <div className="flex items-start justify-between gap-4 mb-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-mono text-text-muted-lm dark:text-text-muted font-bold">
                                                #{ticket.id}
                                            </span>
                                            <Badge variant="secondary" className={`text-[9px] font-bold border-none px-1.5 py-0 uppercase ${getStatusColor(ticket.status)}`}>
                                                {ticket.status}
                                            </Badge>
                                        </div>
                                        <h3 className="text-sm font-bold text-text-lm dark:text-text truncate">
                                            {displaySubject}
                                        </h3>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[10px] font-bold text-text-muted-lm dark:text-text-muted uppercase tracking-tighter mb-0.5">Priority</p>
                                        <p className="text-xs font-black text-text-lm dark:text-text uppercase italic">
                                            {ticket.priority || 'NORMAL'}
                                        </p>
                                    </div>
                                </div>

                                <p className="text-xs text-text-muted-lm dark:text-text-muted line-clamp-2 leading-relaxed mb-4">
                                    {ticket.description}
                                </p>

                                <div className="pt-3 border-t border-border-lm/40 dark:border-border/40 flex items-center justify-between">
                                    <span className="text-[10px] text-text-muted-lm dark:text-text-muted font-medium">
                                        Requested on {date}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 text-[11px] font-bold text-info-lm dark:text-info hover:text-info-lm dark:hover:text-info hover:bg-info-lm/10 dark:hover:bg-info/20 px-3 rounded-lg"
                                        onClick={() => window.open(ticket.url, '_blank', 'noopener,noreferrer')}
                                    >
                                        OPEN TICKET
                                    </Button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export const parseZendeskTickets = (rawResponse: any): any[] | string => {
    if (!rawResponse) return [];

    // Filter out agentic system commands (e.g., agent handoffs)
    if (typeof rawResponse === 'string' && rawResponse.startsWith('Command(')) {
        return [];
    }

    let jsonString = "";
    if (typeof rawResponse === 'string') {
        // 1. Extract content between single quotes: content='[...] '
        const contentMatch = rawResponse.match(/content='([\s\S]*?)'(?=\s|$)/);

        if (contentMatch) {
            // 2. Unescape backslashes (e.g., \" becomes ")
            jsonString = contentMatch[1].replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, '\\');
        } else {
            // Fallback: extract anything that looks like a JSON object
            const generalMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (!generalMatch) return [];
            jsonString = generalMatch[0];
        }
    } else {
        // Handle case where input is already an object containing a 'content' field
        if (rawResponse.content) return parseZendeskTickets(rawResponse.content);
        // Handle case where input is already the parsed result object
        if (Array.isArray(rawResponse?.results)) return rawResponse.results;
        return Array.isArray(rawResponse) ? rawResponse : [];
    }

    try {
        const parsed = JSON.parse(jsonString);
        // Zendesk list_tickets puts the array under the 'results' key
        const tickets = parsed?.results || (Array.isArray(parsed) ? parsed : []);
        return Array.isArray(tickets) ? tickets : [];
    } catch (error) {
        // Return raw response only if it was a JSON-like string that failed to parse
        return jsonString.includes('{') ? rawResponse : [];
    }
};
