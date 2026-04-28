import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface InstagramMedia {
    id: string;
    media_type: string;
    media_url: string;
    caption: string;
    timestamp: string;
    like_count: number;
    comments_count: number;
    permalink_url: string;
}

export function InstagramMediaResponse({ posts }: { posts: InstagramMedia[] }) {
    if (!Array.isArray(posts) || posts.length === 0) return null;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 font-generalSans text-text-lm dark:text-text" onClick={(e) => e.stopPropagation()}>
            {posts.map((post) => {
                const date = new Date(post.timestamp).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric'
                });

                return (
                    <div key={post.id} className="group bg-bg-light-lm dark:bg-bg-light border border-border-lm dark:border-border rounded-2xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow">
                        <div className="aspect-square w-full bg-bg-lm dark:bg-bg relative">
                            <img
                                src={post.media_url}
                                alt={post.caption || "Instagram media"}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute top-3 left-3 flex gap-2">
                                <Badge className="bg-bg/70 dark:bg-bg-light/80 backdrop-blur-md border-0 text-[10px] font-bold text-text">
                                    {post.media_type}
                                </Badge>
                                <Badge className="bg-bg-light-lm/90 dark:bg-bg-light/90 text-text-lm dark:text-text border-0 text-[10px] font-bold">
                                    {date}
                                </Badge>
                            </div>
                        </div>

                        <div className="p-4 flex flex-col flex-1">
                            <p className="text-sm text-text-muted-lm dark:text-text-muted line-clamp-2 mb-4 leading-relaxed font-medium">
                                {post.caption}
                            </p>

                            <div className="mt-auto pt-4 border-t border-border-lm dark:border-border flex items-center justify-between">
                                <div className="flex gap-4">
                                    <div className="text-center">
                                        <p className="text-xs font-black text-text-lm dark:text-text">{post.like_count}</p>
                                        <p className="text-[9px] text-text-muted-lm dark:text-text-muted font-bold uppercase tracking-widest">Likes</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs font-black text-text-lm dark:text-text">{post.comments_count}</p>
                                        <p className="text-[9px] text-text-muted-lm dark:text-text-muted font-bold uppercase tracking-widest">Comments</p>
                                    </div>
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl h-9 text-xs font-bold border-border-lm dark:border-border hover:bg-bg-lm dark:hover:bg-bg"
                                    onClick={() => window.open(post.permalink_url, '_blank')}
                                >
                                    View Post
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export const parseInstagramMedia = (rawResponse: any): any[] | string => {
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
        if (rawResponse.content) return parseInstagramMedia(rawResponse.content);
        return rawResponse?.data || [];
    }

    try {
        const parsed = JSON.parse(jsonString);
        return Array.isArray(parsed?.data) ? parsed.data : [];
    } catch (error) {
        return jsonString.includes('{') ? rawResponse : [];
    }
};
