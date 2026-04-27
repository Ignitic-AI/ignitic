import React from 'react';
import { Button } from "@/components/ui/button";
import {
    Facebook,
    ExternalLink,
    CheckCircle2,
    Share2,
    Clock,
    Copy,
    Layout
} from "lucide-react";

interface FacebookPostData {
    id: string;
    post_id: string;
    permalink_url: string;
}

export function FacebookPostResponse({ data }: { data: FacebookPostData }) {
    if (!data || typeof data === 'string') return null;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(data.permalink_url);
    };

    return (
        <div className="mt-4 max-w-md font-generalSans text-text-lm dark:text-text" onClick={(e) => e.stopPropagation()}>
            <div className="group bg-bg-light-lm dark:bg-bg-light border border-border-lm dark:border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
                <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Facebook className="w-4 h-4 text-[#1877F2]" />
                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest">Post Published</span>
                    </div>
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                </div>

                <div className="p-5">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="w-12 h-12 rounded-full bg-bg-lm dark:bg-bg flex items-center justify-center shrink-0">
                            <Layout className="w-6 h-6 text-zinc-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-bold text-text-lm dark:text-text truncate">
                                Image Post Successful
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                                <Clock className="w-3 h-3 text-zinc-400" />
                                <span className="text-[11px] text-zinc-400">Just now</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 mb-6">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-bg-lm dark:bg-bg border border-border-lm dark:border-border">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase">Post ID</span>
                            <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 truncate ml-4">
                                {data.post_id}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-10 rounded-lg text-xs font-semibold border-border-lm dark:border-border text-text-lm dark:text-text"
                            onClick={copyToClipboard}
                        >
                            <Copy className="w-3.5 h-3.5 mr-2" /> Copy Link
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10 w-10 rounded-lg border-border-lm dark:border-border text-text-lm dark:text-text"
                        >
                            <Share2 className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>

                <div className="p-2 pt-0">
                    <Button
                        className="w-full h-11 bg-primary-lm dark:bg-primary hover:bg-primary-lm/90 dark:hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg shadow-primary-lm/20 dark:shadow-none"
                        onClick={() => window.open(data.permalink_url, '_blank')}
                    >
                        View Post on Facebook <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                </div>
            </div>

            <p className="text-[10px] text-center text-zinc-400 mt-3 font-medium">
                Your content is now visible to your audience.
            </p>
        </div>
    );
}

export const parseFacebookPost = (rawResponse: any): any | string => {
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
        if (rawResponse.content) return parseFacebookPost(rawResponse.content);
        return rawResponse;
    }

    try {
        return JSON.parse(jsonString);
    } catch (error) {
        return jsonString.includes('{') ? rawResponse : null;
    }
};
