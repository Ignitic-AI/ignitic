import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilePenLine, ExternalLink } from "lucide-react";

interface DriveUpdateData {
    id: string;
    name: string;
    mimeType: string;
    webViewLink: string;
    modifiedTime: string;
    size: string;
}

export function GoogleDriveUpdateResponse({ data }: { data: DriveUpdateData }) {
    if (!data || typeof data === 'string') return null;

    const lastModified = new Date(data.modifiedTime).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const formatSize = (bytes: string) => {
        const b = parseInt(bytes, 10);
        if (Number.isNaN(b)) return 'N/A';
        if (b < 1024) return `${b} B`;
        return `${(b / 1024).toFixed(1)} KB`;
    };

    const fileType = data.mimeType?.includes('/') ? data.mimeType.split('/')[1]?.toUpperCase() : data.mimeType || 'N/A';

    return (
        <div className="mt-4 max-w-md font-generalSans text-text-lm dark:text-text" onClick={(e) => e.stopPropagation()}>
            <div className="bg-bg-light-lm dark:bg-bg-light border border-border-lm dark:border-border rounded-xl overflow-hidden shadow-sm">
                <div className="px-4 py-2.5 bg-bg-lm dark:bg-bg border-b border-border-lm dark:border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FilePenLine className="w-3.5 h-3.5 text-primary-lm dark:text-primary" />
                        <span className="text-[10px] font-semibold text-text-muted-lm dark:text-text-muted uppercase tracking-[0.16em]">
                            File Revision
                        </span>
                    </div>
                    <Badge className="bg-warning-lm/15 dark:bg-warning/20 text-warning-lm dark:text-warning border border-warning-lm/25 dark:border-warning/30 text-[10px] font-semibold rounded-full">
                        Content Updated
                    </Badge>
                </div>

                <div className="p-5">
                    <div className="mb-5">
                        <h3 className="text-xl font-semibold font-generalSans text-text-lm dark:text-text leading-tight mb-1">
                            {data.name}
                        </h3>
                        <p className="text-xs font-medium text-text-muted-lm dark:text-text-muted">
                            Updated {lastModified}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-5">
                        <div className="p-3 rounded-xl bg-bg-lm dark:bg-bg border border-border-lm dark:border-border">
                            <p className="text-[10px] font-semibold text-text-muted-lm dark:text-text-muted uppercase tracking-[0.12em] mb-1">New Size</p>
                            <p className="text-sm font-semibold text-text-lm dark:text-text">{formatSize(data.size)}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-bg-lm dark:bg-bg border border-border-lm dark:border-border">
                            <p className="text-[10px] font-semibold text-text-muted-lm dark:text-text-muted uppercase tracking-[0.12em] mb-1">Type</p>
                            <p className="text-sm font-semibold text-text-lm dark:text-text truncate">{fileType}</p>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-bg-lm dark:bg-bg border border-border-lm dark:border-border mb-5">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-semibold text-text-muted-lm dark:text-text-muted uppercase tracking-[0.12em]">
                                File Reference ID
                            </span>
                            <span className="text-[11px] font-mono text-text-muted-lm dark:text-text-muted break-all leading-relaxed">
                                {data.id}
                            </span>
                        </div>
                    </div>

                    <Button
                        className="w-full h-10 bg-primary-lm dark:bg-primary hover:bg-primary-lm/90 dark:hover:bg-primary/90 text-white font-semibold rounded-md transition-colors"
                        onClick={() => window.open(data.webViewLink, '_blank', 'noopener,noreferrer')}
                    >
                        View Updated File
                        <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

export const parseDriveUpdate = (rawResponse: any): any | string => {
    if (!rawResponse) return null;

    // Filter out agent system commands
    if (typeof rawResponse === 'string' && rawResponse.startsWith('Command(')) {
        return null;
    }

    let jsonString = "";
    if (typeof rawResponse === 'string') {
        const contentMatch = rawResponse.match(/content='([\s\S]*?)'(?=\s|$)/);
        if (contentMatch) {
            jsonString = contentMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        } else {
            const generalMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (!generalMatch) return null;
            jsonString = generalMatch[0];
        }
    } else {
        if (rawResponse.content) return parseDriveUpdate(rawResponse.content);
        return rawResponse;
    }

    try {
        return JSON.parse(jsonString);
    } catch (error) {
        return jsonString.includes('{') ? rawResponse : null;
    }
};
