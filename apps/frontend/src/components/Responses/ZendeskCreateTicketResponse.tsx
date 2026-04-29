import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface ZendeskCreateData {
    id: number;
    subject: string;
    description?: string;
    status: string;
    priority?: string;
    created_at: string;
    url: string;
}

function getWebUrl(apiUrl: string, id: number): string {
    const replaced = apiUrl.replace("/api/v2/tickets/", "/agent/tickets/").replace(".json", "");
    if (!replaced.includes("/api/v2/")) return replaced;
    const subdomainMatch = apiUrl.match(/https:\/\/(.*?)\.zendesk\.com/);
    if (subdomainMatch?.[1]) {
        return `https://${subdomainMatch[1]}.zendesk.com/agent/tickets/${id}`;
    }
    return replaced;
}

function statusBadgeClasses(status: string): string {
    switch (status.toLowerCase()) {
        case "open":
            return "border-danger-lm/40 text-danger-lm dark:border-danger/50 dark:text-danger";
        case "pending":
            return "border-warning-lm/40 text-warning-lm dark:border-warning/50 dark:text-warning";
        case "solved":
        case "closed":
            return "border-success-lm/40 text-success-lm dark:border-success/50 dark:text-success";
        default:
            return "border-border-lm text-text-muted-lm dark:border-border dark:text-text-muted";
    }
}

export function ZendeskCreateTicketResponse({ data }: { data: ZendeskCreateData }) {
    if (!data || typeof data === "string") return null;

    const formattedDate = new Date(data.created_at).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    });

    return (
        <div className="mt-4 max-w-md font-generalSans" onClick={(e) => e.stopPropagation()}>
            <div className="bg-bg-light-lm dark:bg-bg-light border border-border-lm dark:border-border rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-3 bg-bg-dark-lm/50 dark:bg-bg/50 border-b border-border-lm/50 dark:border-border/60 flex items-center justify-between">
                    <span className="text-[10px] font-black text-text-muted-lm dark:text-text-muted uppercase tracking-widest">
                        Zendesk Action
                    </span>
                    <Badge className="bg-success-lm/20 text-success-lm dark:bg-success/25 dark:text-success border-none text-[9px] font-bold">
                        TICKET CREATED
                    </Badge>
                </div>

                <div className="p-6">
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-mono font-bold text-text-muted-lm dark:text-text-muted">
                                # {data.id}
                            </span>
                            <Badge
                                variant="outline"
                                className={`text-[9px] font-black uppercase px-1.5 py-0 ${statusBadgeClasses(data.status)}`}
                            >
                                {data.status}
                            </Badge>
                        </div>
                        <h3 className="text-xl font-bold text-text-lm dark:text-text leading-tight">{data.subject}</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="p-3 rounded-xl bg-bg-dark-lm/30 dark:bg-bg/40 border border-border-lm/60 dark:border-border/60">
                            <p className="text-[9px] font-bold text-text-muted-lm dark:text-text-muted uppercase tracking-tighter mb-0.5">
                                Priority
                            </p>
                            <p className="text-sm font-bold text-text-lm dark:text-text uppercase italic">
                                {data.priority || "Normal"}
                            </p>
                        </div>
                        <div className="p-3 rounded-xl bg-bg-dark-lm/30 dark:bg-bg/40 border border-border-lm/60 dark:border-border/60">
                            <p className="text-[9px] font-bold text-text-muted-lm dark:text-text-muted uppercase tracking-tighter mb-0.5">
                                Timestamp
                            </p>
                            <p className="text-sm font-bold text-text-lm dark:text-text leading-tight">{formattedDate}</p>
                        </div>
                    </div>

                    <div className="mb-6 px-1">
                        <span className="text-[9px] font-bold text-text-muted-lm dark:text-text-muted uppercase tracking-widest block mb-2">
                            Initial Comment
                        </span>
                        <p className="text-xs text-text-muted-lm dark:text-text-muted leading-relaxed line-clamp-3 font-medium">
                            {data.description ?? "—"}
                        </p>
                    </div>

                    <Button
                        className="w-full font-bold shadow-sm"
                        size="lg"
                        onClick={() =>
                            window.open(getWebUrl(data.url, data.id), "_blank", "noopener,noreferrer")
                        }
                    >
                        View Ticket
                    </Button>
                </div>
            </div>
        </div>
    );
}

export const parseZendeskCreateTicket = (rawResponse: any): any | string | null => {
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
        if (rawResponse.content) return parseZendeskCreateTicket(rawResponse.content);
        return rawResponse?.ticket || rawResponse;
    }

    try {
        const parsed = JSON.parse(jsonString);
        return parsed?.ticket || parsed;
    } catch {
        return jsonString.includes("{") ? rawResponse : null;
    }
};
