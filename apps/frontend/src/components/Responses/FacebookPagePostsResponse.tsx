import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Facebook,
    ExternalLink,
    MessageSquare,
    Calendar,
    Clock,
    Share2
} from "lucide-react";

interface FacebookPost {
    id: string;
    message?: string;
    created_time: string;
    permalink_url: string;
    full_picture?: string;
}

export function FacebookPagePostsResponse({ posts }: { posts: FacebookPost[] }) {
    if (!Array.isArray(posts) || posts.length === 0) return null;

    return (
        <div className="space-y-6 mt-4 font-generalSans text-text-lm dark:text-text" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <div className="bg-[#1877F2] p-1.5 rounded-lg">
                        <Facebook className="w-4 h-4 text-white fill-current" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-text-lm dark:text-text">Page Feed</h4>
                        <p className="text-[10px] text-text-muted-lm dark:text-text-muted uppercase font-bold tracking-tight">Recent Activity</p>
                    </div>
                </div>
                <Badge variant="outline" className="text-[10px] border-border-lm dark:border-border text-text-muted-lm dark:text-text-muted font-bold">
                    {posts.length} POSTS
                </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {posts.map((post) => {
                    const date = new Date(post.created_time).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    });

                    return (
                        <div key={post.id} className="group flex flex-col bg-bg-light-lm dark:bg-bg-light border border-border-lm dark:border-border rounded-2xl overflow-hidden hover:shadow-md transition-all duration-300">
                            <div className="p-4 bg-bg-lm dark:bg-bg/50 border-b border-border-lm dark:border-border">
                                <Badge variant="secondary" className="bg-bg dark:bg-bg-dark text-text-muted-lm dark:text-text-muted border-none text-[9px]">
                                    <MessageSquare className="w-3 h-3 mr-1" /> TEXT UPDATE
                                </Badge>
                            </div>

                            <div className="p-4 flex flex-col flex-1">
                                <div className="flex items-center gap-2 mb-3 text-[10px] text-text-muted-lm dark:text-text-muted font-bold uppercase tracking-tighter">
                                    <Calendar className="w-3 h-3" />
                                    <span>{date}</span>
                                </div>

                                <p className="text-sm text-text-muted-lm dark:text-text-muted line-clamp-3 mb-4 leading-relaxed font-medium">
                                    {post.message || "No caption provided for this post."}
                                </p>

                                <div className="mt-auto pt-4 border-t border-border-lm dark:border-border flex items-center justify-between">
                                    <div className="flex gap-3 text-text-muted-lm dark:text-text-muted">
                                        <Share2 className="w-3.5 h-3.5 hover:text-primary-lm dark:hover:text-primary cursor-pointer transition-colors" />
                                        <Clock className="w-3.5 h-3.5 hover:text-primary-lm dark:hover:text-primary cursor-pointer transition-colors" />
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 text-[11px] font-bold text-primary-lm dark:text-primary hover:text-primary-lm/90 dark:hover:text-primary/90 hover:bg-primary-lm/10 dark:hover:bg-primary/20 px-2"
                                        onClick={() => window.open(post.permalink_url, '_blank')}
                                    >
                                        VIEW POST <ExternalLink className="w-3 h-3 ml-1.5" />
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

export const parseFacebookPagePosts = (rawResponse: any): any[] | string => {
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
            // Check if it's a raw JSON string without the content='' wrapper
            const generalMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (!generalMatch) return [];
            jsonString = generalMatch[0];
        }
    } else {
        if (rawResponse.content) return parseFacebookPagePosts(rawResponse.content);
        return rawResponse?.data || [];
    }

    try {
        const parsed = JSON.parse(jsonString);
        return Array.isArray(parsed?.data) ? parsed.data : [];
    } catch (error) {
        return jsonString.includes('{') ? rawResponse : [];
    }
};
