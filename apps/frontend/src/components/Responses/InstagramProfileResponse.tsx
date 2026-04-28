import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface InstagramProfileData {
    username: string;
    name: string;
    followers_count: number;
    follows_count: number;
    media_count: number;
    latest_post_permalink_url: string;
}

export function InstagramProfileResponse({ data }: { data: InstagramProfileData }) {
    if (!data || typeof data === 'string') return null;

    return (
        <div className="mt-4 max-w-sm font-generalSans text-text-lm dark:text-text" onClick={(e) => e.stopPropagation()}>
            <div className="bg-bg-light-lm dark:bg-bg-light border border-border-lm dark:border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="p-5 border-b border-border-lm dark:border-border">
                    <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-bg-lm dark:bg-bg flex items-center justify-center mb-3">
                            <span className="text-xl font-bold text-text-muted-lm dark:text-text-muted uppercase">
                                {data.username?.[0] || "U"}
                            </span>
                        </div>
                        <h3 className="text-lg font-bold text-text-lm dark:text-text leading-tight">
                            {data.name}
                        </h3>
                        <p className="text-sm text-text-muted-lm dark:text-text-muted font-medium">@{data.username}</p>
                    </div>
                </div>

                <div className="grid grid-cols-3 py-4 bg-bg-lm/60 dark:bg-bg/60 border-b border-border-lm dark:border-border">
                    <div className="text-center border-r border-border-lm dark:border-border">
                        <p className="text-sm font-bold text-text-lm dark:text-text">{data.media_count}</p>
                        <p className="text-[10px] text-text-muted-lm dark:text-text-muted font-bold uppercase tracking-tighter">Posts</p>
                    </div>
                    <div className="text-center border-r border-border-lm dark:border-border">
                        <p className="text-sm font-bold text-text-lm dark:text-text">{data.followers_count}</p>
                        <p className="text-[10px] text-text-muted-lm dark:text-text-muted font-bold uppercase tracking-tighter">Followers</p>
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-bold text-text-lm dark:text-text">{data.follows_count}</p>
                        <p className="text-[10px] text-text-muted-lm dark:text-text-muted font-bold uppercase tracking-tighter">Following</p>
                    </div>
                </div>

                <div className="p-4 bg-bg-light-lm dark:bg-bg-light flex flex-col gap-2">
                    <Badge variant="outline" className="w-fit mx-auto text-[10px] border-border-lm dark:border-border text-text-muted-lm dark:text-text-muted font-bold mb-2">
                        LATEST ACTIVITY DETECTED
                    </Badge>
                    <Button
                        className="w-full h-11 bg-primary-lm dark:bg-primary text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
                        onClick={() => window.open(data.latest_post_permalink_url, '_blank')}
                    >
                        View Latest Post
                    </Button>
                </div>
            </div>
        </div>
    );
}

export const parseInstagramProfile = (rawResponse: any): any | string => {
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
        if (rawResponse.content) return parseInstagramProfile(rawResponse.content);
        return rawResponse;
    }

    try {
        return JSON.parse(jsonString);
    } catch (error) {
        return jsonString.includes('{') ? rawResponse : null;
    }
};
