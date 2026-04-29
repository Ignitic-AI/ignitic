import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ZendeskTicket {
    id: number;
    subject: string;
    description?: string;
    status: string;
    priority?: string;
    created_at: string;
    url: string;
}

export function ZendeskUserTicketsResponse({ tickets }: { tickets: ZendeskTicket[] }) {
    if (!Array.isArray(tickets) || tickets.length === 0) return null;

    const getStatusTheme = (status: string) => {
        switch (status.toLowerCase()) {
            case "open":
                return "bg-danger-lm/15 text-danger-lm dark:bg-danger/25 dark:text-danger border-danger-lm/30 dark:border-danger/40";
            case "pending":
                return "bg-warning-lm/15 text-warning-lm dark:bg-warning/25 dark:text-warning border-warning-lm/30 dark:border-warning/40";
            case "solved":
                return "bg-success-lm/15 text-success-lm dark:bg-success/25 dark:text-success border-success-lm/30 dark:border-success/40";
            default:
                return "bg-bg-lm text-text-muted-lm dark:bg-bg dark:text-text-muted border-border-lm dark:border-border";
        }
    };

    const openTicketUrl = (url: string) => {
        const href = url.includes(".json") ? url.replace(".json", "") : url;
        window.open(href, "_blank", "noopener,noreferrer");
    };

    return (
        <div className="space-y-4 mt-4 font-generalSans" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-black text-text-muted-lm dark:text-text-muted uppercase tracking-[0.15em]">
                    User Support History
                </p>
                <Badge
                    variant="secondary"
                    className="bg-bg-dark-lm dark:bg-bg text-text-muted-lm dark:text-text-muted text-[10px] font-bold border-none"
                >
                    {tickets.length} {tickets.length === 1 ? "Ticket" : "Tickets"} Found
                </Badge>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {tickets.map((ticket) => {
                    const date = new Date(ticket.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                    });
                    const displaySubject = (ticket.subject || "").replace(/^SAMPLE:\s*/i, "");

                    return (
                        <div
                            key={ticket.id}
                            className="bg-bg-light-lm dark:bg-bg-light border border-border-lm dark:border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow"
                        >
                            <div className="p-5">
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <Badge
                                                variant="outline"
                                                className={`text-[9px] font-black uppercase px-1.5 py-0 border ${getStatusTheme(ticket.status)}`}
                                            >
                                                {ticket.status}
                                            </Badge>
                                            <span className="text-[10px] font-mono text-text-muted-lm dark:text-text-muted">
                                                #{ticket.id}
                                            </span>
                                        </div>
                                        <h3 className="text-sm font-bold text-text-lm dark:text-text line-clamp-1">
                                            {displaySubject}
                                        </h3>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <span className="text-[10px] font-bold text-text-muted-lm dark:text-text-muted uppercase block mb-0.5">
                                            Priority
                                        </span>
                                        <span className="text-[10px] font-black text-text-lm dark:text-text uppercase">
                                            {ticket.priority || "normal"}
                                        </span>
                                    </div>
                                </div>

                                <p className="text-xs text-text-muted-lm dark:text-text-muted line-clamp-2 leading-relaxed mb-5">
                                    {ticket.description ?? ""}
                                </p>

                                <div className="flex items-center justify-between pt-4 border-t border-border-lm/40 dark:border-border/40">
                                    <span className="text-[10px] font-medium text-text-muted-lm dark:text-text-muted">
                                        Submitted {date}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9 text-xs font-bold border-border-lm dark:border-border hover:bg-bg-dark-lm dark:hover:bg-bg"
                                        onClick={() => openTicketUrl(ticket.url)}
                                    >
                                        View Details
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

export const parseZendeskUserTickets = (rawResponse: any): any[] | string => {
    if (!rawResponse) return [];

    // Filter out agent system commands
    if (typeof rawResponse === "string" && rawResponse.startsWith("Command(")) {
        return [];
    }

    let jsonString = "";
    if (typeof rawResponse === "string") {
        const contentMatch = rawResponse.match(/content='([\s\S]*?)'(?=\s|$)/);

        if (contentMatch) {
            // Normalize escaping: handling \" for JSON and \\' for apostrophes
            jsonString = contentMatch[1]
                .replace(/\\"/g, '"')
                .replace(/\\'/g, "'")
                .replace(/\\\\/g, "\\");
        } else {
            const generalMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (!generalMatch) return [];
            jsonString = generalMatch[0];
        }
    } else {
        if (rawResponse.content) return parseZendeskUserTickets(rawResponse.content);
        return rawResponse?.tickets || [];
    }

    try {
        const parsed = JSON.parse(jsonString);
        // The results for user tickets are returned under the 'tickets' key
        return Array.isArray(parsed?.tickets) ? parsed.tickets : [];
    } catch {
        return jsonString.includes("{") ? rawResponse : [];
    }
};
