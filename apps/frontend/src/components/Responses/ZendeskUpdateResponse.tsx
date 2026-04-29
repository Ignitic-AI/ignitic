import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface UpdateEvent {
    type: string;
    value: string;
    field_name: string;
    previous_value: string;
}

export interface ZendeskUpdateData {
    ticket: {
        id: number;
        subject: string;
        status: string;
        url: string;
        updated_at: string;
    };
    audit?: {
        events?: UpdateEvent[];
    };
}

export function ZendeskUpdateResponse({ data }: { data: ZendeskUpdateData }) {
    if (!data || typeof data === "string" || !data.ticket) return null;

    const { ticket, audit } = data;
    const events = (audit?.events ?? []).filter((e) => e.type === "Change");

    const updatedAt = new Date(ticket.updated_at).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
    });

    const subject = (ticket.subject || "").replace(/^SAMPLE:\s*/i, "");

    const openTicket = () => {
        const href = ticket.url.includes(".json") ? ticket.url.replace(".json", "") : ticket.url;
        window.open(href, "_blank", "noopener,noreferrer");
    };

    return (
        <div className="mt-4 max-w-md font-generalSans" onClick={(e) => e.stopPropagation()}>
            <div className="bg-bg-light-lm dark:bg-bg-light border border-border-lm dark:border-border rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-3 bg-bg-dark-lm/50 dark:bg-bg/50 border-b border-border-lm/50 dark:border-border/60 flex items-center justify-between">
                    <span className="text-[10px] font-black text-text-muted-lm dark:text-text-muted uppercase tracking-widest">
                        Ticket Update
                    </span>
                    <Badge className="bg-success-lm/20 text-success-lm dark:bg-success/25 dark:text-success border-none text-[9px] font-bold">
                        SUCCESS
                    </Badge>
                </div>

                <div className="p-6">
                    <div className="mb-6">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono font-bold text-text-muted-lm dark:text-text-muted">
                                #{ticket.id}
                            </span>
                            <span className="text-[10px] font-bold text-text-muted-lm dark:text-text-muted uppercase tracking-tighter">
                                • Updated at {updatedAt}
                            </span>
                        </div>
                        <h3 className="text-lg font-bold text-text-lm dark:text-text leading-tight">{subject}</h3>
                    </div>

                    <div className="space-y-3 mb-6">
                        <p className="text-[9px] font-black text-text-muted-lm dark:text-text-muted uppercase tracking-widest">
                            Modified Fields
                        </p>
                        {events.length === 0 ? (
                            <p className="text-xs text-text-muted-lm dark:text-text-muted">No field-level changes in the audit payload.</p>
                        ) : (
                            events.map((event, idx) => (
                                <div
                                    key={`${event.field_name}-${idx}`}
                                    className="p-3 rounded-xl bg-bg-dark-lm/30 dark:bg-bg/40 border border-border-lm/60 dark:border-border/60"
                                >
                                    <div className="flex justify-between items-center mb-2 gap-2">
                                        <span className="text-[10px] font-bold text-text-muted-lm dark:text-text-muted uppercase truncate">
                                            {event.field_name}
                                        </span>
                                        <Badge
                                            variant="outline"
                                            className="text-[9px] border-border-lm dark:border-border font-mono shrink-0"
                                        >
                                            UPDATED
                                        </Badge>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                        <span className="text-text-muted-lm dark:text-text-muted line-through decoration-border-lm dark:decoration-border italic break-all">
                                            {event.previous_value}
                                        </span>
                                        <span className="text-text-muted-lm dark:text-text-muted">→</span>
                                        <span className="font-bold text-text-lm dark:text-text break-all">{event.value}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <Button className="w-full font-bold" size="lg" onClick={openTicket}>
                        View Ticket Status
                    </Button>
                </div>
            </div>
        </div>
    );
}

export const parseZendeskUpdate = (rawResponse: any): any | string | null => {
    if (!rawResponse) return null;

    if (typeof rawResponse === "string" && rawResponse.startsWith("Command(")) {
        return null;
    }

    let jsonString = "";
    if (typeof rawResponse === "string") {
        const contentMatch = rawResponse.match(/content='([\s\S]*?)'(?=\s|$)/);
        if (contentMatch) {
            jsonString = contentMatch[1]
                .replace(/\\"/g, '"')
                .replace(/\\'/g, "'")
                .replace(/\\\\/g, "\\");
        } else {
            const generalMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (!generalMatch) return null;
            jsonString = generalMatch[0];
        }
    } else {
        if (rawResponse.content) return parseZendeskUpdate(rawResponse.content);
        return rawResponse;
    }

    try {
        const parsed = JSON.parse(jsonString);
        return {
            ticket: parsed.ticket,
            audit: parsed.audit,
        };
    } catch {
        return jsonString.includes("{") ? rawResponse : null;
    }
};
