import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Folder, FileText, ExternalLink } from "lucide-react";

interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    webViewLink: string;
    size?: string;
    modifiedTime: string;
}

export function GoogleDriveListResponse({ files }: { files: DriveFile[] }) {
    if (!Array.isArray(files) || files.length === 0) return null;

    const formatSize = (bytes?: string) => {
        if (!bytes) return '--';
        const b = parseInt(bytes, 10);
        if (Number.isNaN(b)) return '--';
        if (b < 1024) return `${b} B`;
        const kb = b / 1024;
        if (kb < 1024) return `${kb.toFixed(1)} KB`;
        const mb = kb / 1024;
        return `${mb.toFixed(1)} MB`;
    };

    return (
        <div className="mt-4 grid grid-cols-1 gap-4 font-generalSans sm:grid-cols-2" onClick={(e) => e.stopPropagation()}>
            {files.map((file) => {
                const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                const date = new Date(file.modifiedTime).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric'
                });

                return (
                    <div
                        key={file.id}
                        className="group flex flex-col rounded-xl border border-border-lm bg-bg-light-lm p-4 text-text-lm shadow-sm transition-all hover:shadow-md dark:border-border dark:bg-bg-light dark:text-text"
                    >
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <h3 className="truncate pr-2 text-sm font-semibold">{file.name}</h3>
                                <div className="mt-1 flex items-center gap-2">
                                    <Badge
                                        className={`border text-[10px] font-semibold rounded-full ${
                                            isFolder
                                                ? 'bg-warning-lm/15 dark:bg-warning/20 text-warning-lm dark:text-warning border-warning-lm/25 dark:border-warning/30'
                                                : 'bg-primary-lm/15 dark:bg-primary/20 text-primary-lm dark:text-primary border-primary-lm/25 dark:border-primary/30'
                                        }`}
                                    >
                                        {isFolder ? 'Folder' : file.mimeType.split('/').pop()?.toUpperCase() || 'File'}
                                    </Badge>
                                    <span className="text-[10px] font-medium text-text-muted-lm dark:text-text-muted">{date}</span>
                                </div>
                            </div>
                            {isFolder ? (
                                <Folder className="h-4 w-4 flex-shrink-0 text-warning-lm dark:text-warning" />
                            ) : (
                                <FileText className="h-4 w-4 flex-shrink-0 text-primary-lm dark:text-primary" />
                            )}
                        </div>

                        <div className="mt-auto flex items-center justify-between border-t border-border-lm/60 pt-3 dark:border-border">
                            <span className="text-[10px] font-mono text-text-muted-lm dark:text-text-muted">
                                {isFolder ? '--' : formatSize(file.size)}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-[11px] font-semibold text-text-muted-lm hover:text-text-lm dark:text-text-muted dark:hover:text-text"
                                onClick={() => window.open(file.webViewLink, '_blank', 'noopener,noreferrer')}
                            >
                                Open {isFolder ? 'Folder' : 'File'}
                                <ExternalLink className="ml-1 h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export const parseDriveFiles = (rawResponse: any): any[] | string => {
    if (!rawResponse) return [];

    // Filter out agent system commands
    if (typeof rawResponse === 'string' && rawResponse.startsWith('Command(')) {
        return [];
    }

    let jsonString = "";
    if (typeof rawResponse === 'string') {
        const contentMatch = rawResponse.match(/content='([\s\S]*?)'(?=\s|$)/);
        if (contentMatch) {
            jsonString = contentMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        } else {
            const generalMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (!generalMatch) return [];
            jsonString = generalMatch[0];
        }
    } else {
        if (rawResponse.content) return parseDriveFiles(rawResponse.content);
        return rawResponse?.files || [];
    }

    try {
        const parsed = JSON.parse(jsonString);
        return Array.isArray(parsed?.files) ? parsed.files : [];
    } catch (error) {
        return jsonString.includes('{') ? rawResponse : [];
    }
};
