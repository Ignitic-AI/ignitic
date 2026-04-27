import React from 'react';
import { Button } from "@/components/ui/button";
import {
    Facebook,
    ExternalLink,
    CheckCircle2,
    Copy,
    Globe,
    FileText,
    ArrowUpRight
} from "lucide-react";

interface FacebookCreatePostData {
    id: string;
    permalink_url: string;
}

export function FacebookCreatePostResponse({ data }: { data: FacebookCreatePostData }) {
    if (!data || typeof data === 'string') return null;

    const copyUrl = () => {
        navigator.clipboard.writeText(data.permalink_url);
    };

    return (
        <div className="mt-4 max-w-md font-generalSans text-text-lm dark:text-text" onClick={(e) => e.stopPropagation()}>
            <div className="bg-bg-light-lm dark:bg-bg-light border border-border-lm dark:border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                <div className="px-4 py-2.5 bg-[#1877F2]/5 dark:bg-[#1877F2]/10 border-b border-border-lm dark:border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-[#1877F2] p-1 rounded-md">
                            <Facebook className="w-3 h-3 text-white fill-current" />
                        </div>
                        <span className="text-[10px] font-black text-[#1877F2] uppercase tracking-tighter">Facebook Feed</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-emerald-600 uppercase">Live Now</span>
                    </div>
                </div>

                <div className="p-5">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-bg-lm dark:bg-bg flex items-center justify-center border border-border-lm dark:border-border">
                            <FileText className="w-5 h-5 text-text-muted-lm dark:text-text-muted" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-text-lm dark:text-text">Post Created</h3>
                            <p className="text-[11px] text-text-muted-lm dark:text-text-muted flex items-center gap-1">
                                <Globe className="w-3 h-3" /> Public Privacy Setting
                            </p>
                        </div>
                    </div>

                    <div className="mb-6 group/id relative">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-bg-lm dark:bg-bg border border-dashed border-border-lm dark:border-border">
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold text-text-muted-lm dark:text-text-muted uppercase mb-0.5">Global Object ID</p>
                                <p className="text-[11px] font-mono text-text-muted-lm dark:text-text-muted truncate tracking-tighter">
                                    {data.id}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-bg-light-lm dark:hover:bg-bg-light"
                                onClick={copyUrl}
                            >
                                <Copy className="w-3.5 h-3.5 text-text-muted-lm dark:text-text-muted" />
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-5 gap-2">
                        <Button
                            className="col-span-4 h-11 bg-primary-lm dark:bg-primary hover:bg-primary-lm/90 dark:hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg shadow-primary-lm/20 dark:shadow-none transition-transform active:scale-[0.98]"
                            onClick={() => window.open(data.permalink_url, '_blank')}
                        >
                            View Live Post <ArrowUpRight className="w-4 h-4 ml-2" />
                        </Button>
                        <Button
                            variant="outline"
                            className="h-11 rounded-xl border-border-lm dark:border-border text-text-lm dark:text-text"
                            onClick={() => window.open(`https://developers.facebook.com/tools/debug/echo/?q=${data.permalink_url}`, '_blank')}
                        >
                            <ExternalLink className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-center gap-1.5 mt-4">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span className="text-[10px] text-text-muted-lm dark:text-text-muted font-medium italic">Handled by Facebook Graph API v19.0</span>
            </div>
        </div>
    );
}

export const parseFacebookCreatePost = (rawResponse: any): any | string => {
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
        if (rawResponse.content) return parseFacebookCreatePost(rawResponse.content);
        return rawResponse;
    }

    try {
        return JSON.parse(jsonString);
    } catch (error) {
        return jsonString.includes('{') ? rawResponse : null;
    }
};
