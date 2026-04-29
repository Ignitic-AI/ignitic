import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface ZendeskTicketData {
    id: number;
    subject: string;
    description?: string;
    status: string;
    priority?: string;
    created_at: string;
    tags?: string[];
    url: string;
    requester_id?: number | null;
}

export function ZendeskTicketDetailResponse({ data }: { data: ZendeskTicketData }) {
    if (!data || typeof data === "string") return null;

    const createdAt = new Date(data.created_at).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    });

    const getStatusStyles = (status: string) => {
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

    const getWebUrl = (apiUrl: string, id: number) => {
        const subdomainMatch = apiUrl.match(/https:\/\/(.*?)\.zendesk\.com/);
        if (subdomainMatch?.[1]) {
            return `https://${subdomainMatch[1]}.zendesk.com/agent/tickets/${id}`;
        }
        return apiUrl;
    };

    const subject = (data.subject || "").replace(/^SAMPLE:\s*/i, "");
    const description = data.description ?? "";
    const requesterLabel =
        data.requester_id != null ? String(data.requester_id) : "—";

    return (
        <div className="mt-4 max-w-2xl font-generalSans" onClick={(e) => e.stopPropagation()}>
            <div className="bg-bg-light-lm dark:bg-bg-light border border-border-lm dark:border-border rounded-xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-border-lm/50 dark:border-border/60">
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                        <span className="text-xs font-mono font-bold text-text-muted-lm dark:text-text-muted">
                            TICKET #{data.id}
                        </span>
                        <Badge
                            variant="outline"
                            className={`text-[10px] font-black uppercase px-2 py-0.5 border ${getStatusStyles(data.status)}`}
                        >
                            {data.status}
                        </Badge>
                        <Badge
                            variant="secondary"
                            className="text-[10px] font-bold uppercase bg-bg-dark-lm dark:bg-bg text-text-muted-lm dark:text-text-muted border-none"
                        >
                            {(data.priority || "Normal") + " Priority"}
                        </Badge>
                    </div>

                    <h2 className="text-xl font-black text-text-lm dark:text-text leading-tight">{subject}</h2>
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <span className="block text-[10px] font-black text-text-muted-lm dark:text-text-muted uppercase tracking-widest mb-2">
                            Description
                        </span>
                        <p className="text-sm text-text-muted-lm dark:text-text-muted font-medium leading-relaxed whitespace-pre-wrap">
                            {description || "—"}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 py-4 border-y border-border-lm/40 dark:border-border/40">
                        <div>
                            <span className="block text-[10px] font-black text-text-muted-lm dark:text-text-muted uppercase tracking-widest mb-1">
                                Created On
                            </span>
                            <span className="text-xs font-bold text-text-lm dark:text-text">{createdAt}</span>
                        </div>
                        <div>
                            <span className="block text-[10px] font-black text-text-muted-lm dark:text-text-muted uppercase tracking-widest mb-1">
                                Requester ID
                            </span>
                            <span className="text-xs font-mono text-text-muted-lm dark:text-text-muted">{requesterLabel}</span>
                        </div>
                    </div>

                    {data.tags && data.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {data.tags.slice(0, 5).map((tag) => (
                                <span
                                    key={tag}
                                    className="text-[9px] font-bold text-text-muted-lm dark:text-text-muted bg-bg-dark-lm dark:bg-bg px-2 py-0.5 rounded border border-border-lm dark:border-border"
                                >
                                    {tag.toUpperCase()}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-bg-dark-lm/40 dark:bg-bg/40 border-t border-border-lm/50 dark:border-border/60">
                    <Button
                        className="w-full font-bold"
                        size="lg"
                        onClick={() =>
                            window.open(getWebUrl(data.url, data.id), "_blank", "noopener,noreferrer")
                        }
                    >
                        View in Zendesk Dashboard
                    </Button>
                </div>
            </div>
        </div>
    );
}

export const parseZendeskTicket = (rawResponse: any): any | string | null => {
    if (!rawResponse) return null;

    // Filter out agentic system commands (handoffs, etc.)
    if (typeof rawResponse === "string" && rawResponse.startsWith("Command(")) {
        return null;
    }

    let jsonString = "";
    if (typeof rawResponse === "string") {
        const contentMatch = rawResponse.match(/content='([\s\S]*?)'(?=\s|$)/);
        if (contentMatch) {
            // Unescape backslashes (e.g., \" becomes ")
            jsonString = contentMatch[1].replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, "\\");
        } else {
            const generalMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (!generalMatch) return null;
            jsonString = generalMatch[0];
        }
    } else {
        if (rawResponse.content) return parseZendeskTicket(rawResponse.content);
        return rawResponse?.ticket || rawResponse;
    }

    try {
        const parsed = JSON.parse(jsonString);
        return parsed?.ticket || parsed;
    } catch (error) {
        return jsonString.includes("{") ? rawResponse : null;
    }
};
