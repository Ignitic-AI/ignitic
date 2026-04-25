import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    UserPlus,
    Mail,
    Phone,
    ExternalLink,
    CheckCircle2,
    Building2,
    Calendar,
    Contact2
} from "lucide-react";

interface HubSpotContact {
    id: string;
    properties: {
        firstname: string;
        lastname: string;
        email: string;
        phone: string;
        lifecyclestage: string;
        hs_email_domain: string;
    };
    url: string;
    createdAt: string;
}

export function HubSpotBatchCreateResponse({ results }: { results: HubSpotContact[] }) {
    if (!Array.isArray(results) || results.length === 0) return null;

    const totalCreated = results.length;

    return (
        <div className="space-y-4 mt-4 font-sans" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-xl">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-500 p-2 rounded-lg">
                        <UserPlus className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Batch Creation Successful</h4>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">{totalCreated} contacts added to HubSpot CRM</p>
                    </div>
                </div>
                <Badge className="bg-emerald-200 text-emerald-800 border-none hover:bg-emerald-200">
                    COMPLETE
                </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {results.map((contact) => (
                    <Sheet key={contact.id}>
                        <SheetTrigger asChild>
                            <div className="group cursor-pointer bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 hover:shadow-md hover:border-[#ff7a59] transition-all">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center font-bold text-zinc-500 uppercase">
                                            {contact.properties.firstname[0]}{contact.properties.lastname[0]}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                                {contact.properties.firstname} {contact.properties.lastname}
                                            </h3>
                                            <p className="text-[11px] text-zinc-400 truncate">{contact.properties.email}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5 border-t border-zinc-50 dark:border-zinc-900 pt-3">
                                    <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                                        <Phone className="w-3 h-3" />
                                        <span>{contact.properties.phone || 'No phone'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 uppercase font-bold tracking-tighter">
                                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-zinc-200">
                                            {contact.properties.lifecyclestage}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </SheetTrigger>

                        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col bg-white">
                            <SheetHeader className="px-6 py-4 border-b bg-zinc-50/50">
                                <div className="flex items-center gap-2 text-[#ff7a59]">
                                    <Contact2 className="w-4 h-4" />
                                    <SheetTitle className="text-xs font-black uppercase tracking-widest">Contact Record</SheetTitle>
                                </div>
                            </SheetHeader>

                            <div className="flex-1 overflow-y-auto p-8 space-y-8">
                                <div className="text-center">
                                    <div className="w-20 h-20 rounded-3xl bg-[#ff7a59] text-white flex items-center justify-center text-3xl font-black mx-auto mb-4 shadow-lg shadow-orange-100">
                                        {contact.properties.firstname[0]}
                                    </div>
                                    <h2 className="text-2xl font-black text-zinc-900">
                                        {contact.properties.firstname} {contact.properties.lastname}
                                    </h2>
                                    <p className="text-zinc-400 font-medium">Contact ID: {contact.id}</p>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Mail className="w-4 h-4 text-zinc-400" />
                                                <span className="text-sm font-semibold text-zinc-900">{contact.properties.email}</span>
                                            </div>
                                            <Badge variant="secondary" className="text-[10px] bg-white border-zinc-200">{contact.properties.hs_email_domain}</Badge>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Phone className="w-4 h-4 text-zinc-400" />
                                            <span className="text-sm font-semibold text-zinc-900">{contact.properties.phone}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 rounded-2xl border border-zinc-100">
                                            <div className="flex items-center gap-2 text-zinc-400 mb-1">
                                                <Building2 className="w-3.5 h-3.5" />
                                                <span className="text-[10px] font-bold uppercase tracking-tighter">Stage</span>
                                            </div>
                                            <div className="text-sm font-black text-[#ff7a59] uppercase">{contact.properties.lifecyclestage}</div>
                                        </div>
                                        <div className="p-4 rounded-2xl border border-zinc-100">
                                            <div className="flex items-center gap-2 text-zinc-400 mb-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                <span className="text-[10px] font-bold uppercase tracking-tighter">Created</span>
                                            </div>
                                            <div className="text-sm font-bold">{new Date(contact.createdAt).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                    <p className="text-xs font-medium text-emerald-800">This contact was successfully synced with the master database via Integration.</p>
                                </div>
                            </div>

                            <div className="p-4 border-t bg-white sticky bottom-0">
                                <Button
                                    className="w-full h-12 bg-[#ff7a59] hover:bg-[#e56a4d] text-white font-bold rounded-xl shadow-lg shadow-orange-100"
                                    onClick={() => window.open(contact.url, '_blank')}
                                >
                                    Open in HubSpot <ExternalLink className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </SheetContent>
                    </Sheet>
                ))}
            </div>
        </div>
    );
}

export const parseHubSpotBatchCreate = (rawResponse: any): any[] | string => {
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
        if (rawResponse.content) return parseHubSpotBatchCreate(rawResponse.content);
        return rawResponse?.results || [];
    }

    try {
        const parsed = JSON.parse(jsonString);
        return Array.isArray(parsed?.results) ? parsed.results : [];
    } catch (error) {
        return jsonString.includes('{') ? rawResponse : [];
    }
};
