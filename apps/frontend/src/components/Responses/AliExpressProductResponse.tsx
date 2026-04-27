import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
    Star, 
    ShoppingCart, 
    ExternalLink, 
    Truck, 
    Tag, 
    Package,
    Flame,
    TrendingUp
} from "lucide-react";

interface AliExpressProduct {
    product_id: string;
    title: string;
    current_price: number;
    original_price: number;
    discount_percent: number;
    total_orders: number;
    rating: number;
    currency_code: string;
    sale_price_formatted: string;
    original_price_formatted: string;
    product_detail_url: string;
    main_image_url: string;
    shipping_is_free: boolean | null;
}

export function AliExpressProductResponse({ products }: { products: AliExpressProduct[] }) {
    if (!Array.isArray(products) || products.length === 0) return null;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4 font-generalSans text-text-lm dark:text-text" onClick={(e) => e.stopPropagation()}>
            {products.map((item, i) => (
                <Sheet key={item.product_id || i}>
                    <SheetTrigger asChild>
                        <div className="group cursor-pointer flex flex-col bg-bg-light-lm dark:bg-bg-light rounded-xl border border-border-lm dark:border-border overflow-hidden hover:shadow-xl transition-all duration-300">
                            <div className="aspect-square w-full bg-bg-lm dark:bg-bg flex items-center justify-center relative overflow-hidden">
                                <img 
                                    src={item.main_image_url} 
                                    alt={item.title} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                />
                                {item.discount_percent > 0 && (
                                    <div className="absolute top-2 left-2 bg-[#FF4747] text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                                        -{item.discount_percent}%
                                    </div>
                                )}
                                {item.total_orders > 1000 && (
                                    <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md text-white text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                        <Flame className="w-2.5 h-2.5 text-orange-400 fill-current" /> Hot
                                    </div>
                                )}
                            </div>

                            <div className="p-4 flex flex-col flex-1">
                                <div className="flex items-center gap-1.5 mb-2">
                                    <div className="flex items-center text-orange-500">
                                        <Star className="w-3 h-3 fill-current" />
                                        <span className="text-[11px] font-bold ml-0.5 text-zinc-700 dark:text-zinc-300">{item.rating}</span>
                                    </div>
                                    <span className="text-[10px] text-zinc-400 font-medium">| {item.total_orders.toLocaleString()}+ sold</span>
                                </div>

                                <h3 className="text-[13px] font-medium text-text-lm dark:text-text line-clamp-2 leading-snug mb-3 group-hover:text-primary-lm dark:group-hover:text-primary transition-colors">
                                    {item.title}
                                </h3>

                                <div className="mt-auto space-y-1">
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-lg font-black text-[#FF4747]">{item.sale_price_formatted}</span>
                                        <span className="text-[10px] text-zinc-400 line-through">{item.original_price_formatted}</span>
                                    </div>
                                    {item.shipping_is_free && (
                                        <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                                            <Truck className="w-3 h-3" /> Free Shipping
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </SheetTrigger>

                    <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col bg-bg-light-lm dark:bg-bg-light border-l border-border-lm dark:border-border font-generalSans">
                        <SheetHeader className="px-6 py-4 border-b border-border-lm dark:border-border bg-bg-lm/50 dark:bg-bg/50 sticky top-0 z-10">
                            <SheetTitle className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF4747] flex items-center gap-2">
                                <ShoppingCart className="w-3.5 h-3.5" /> AliExpress Marketplace
                            </SheetTitle>
                        </SheetHeader>

                        <div className="flex-1 overflow-y-auto p-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="aspect-square rounded-2xl border border-border-lm dark:border-border bg-bg-lm dark:bg-bg overflow-hidden shadow-inner">
                                    <img src={item.main_image_url} alt="" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex flex-col justify-center space-y-4">
                                    <h2 className="text-xl font-bold text-zinc-900 leading-tight">{item.title}</h2>
                                    
                                    <div className="p-4 bg-[#FFF0F0] rounded-2xl border border-[#FFDADA]">
                                        <div className="text-[10px] font-black text-[#FF4747] uppercase mb-1">Limited Time Deal</div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-4xl font-black text-[#FF4747]">{item.sale_price_formatted}</span>
                                            <span className="text-sm text-zinc-400 line-through italic">{item.original_price_formatted}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 bg-zinc-50 rounded-xl text-center">
                                            <div className="text-[10px] font-bold text-zinc-400 uppercase">Rating</div>
                                            <div className="text-lg font-black text-text-lm dark:text-text">{item.rating} / 5.0</div>
                                        </div>
                                        <div className="p-3 bg-zinc-50 rounded-xl text-center">
                                            <div className="text-[10px] font-bold text-zinc-400 uppercase">Orders</div>
                                            <div className="text-lg font-black text-text-lm dark:text-text">{item.total_orders.toLocaleString()}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-zinc-400">
                                    <Package className="w-4 h-4" />
                                    <h4 className="text-xs font-bold uppercase tracking-widest">Shipping & Handling</h4>
                                </div>
                                <div className="p-6 rounded-2xl border border-zinc-100 bg-zinc-50/50 space-y-4">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-zinc-500">Shipping Cost</span>
                                        <span className="font-bold text-emerald-600">{item.shipping_is_free ? 'FREE' : 'Calculated at checkout'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-zinc-500">Buyer Protection</span>
                                        <span className="font-bold">75-Day Money Back Guarantee</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 rounded-2xl bg-orange-50 border border-orange-100 space-y-3">
                                <div className="flex items-center gap-2 text-orange-600">
                                    <TrendingUp className="w-4 h-4" />
                                    <h4 className="text-xs font-bold uppercase tracking-widest">Sales Insights</h4>
                                </div>
                                <p className="text-xs text-orange-800 font-medium leading-relaxed">
                                    This product has been ordered over <span className="font-black underline">{item.total_orders} times</span>, 
                                    maintaining a high satisfaction score of <span className="font-black">{item.rating} stars</span>. 
                                    A discount of {item.discount_percent}% is currently active.
                                </p>
                            </div>

                            <div className="pt-4 text-center">
                                <p className="text-[9px] text-zinc-300 font-mono">Product ID: {item.product_id}</p>
                            </div>
                        </div>

                        <div className="p-4 border-t border-border-lm dark:border-border bg-bg-light-lm dark:bg-bg-light sticky bottom-0 flex gap-3">
                            <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold border-border-lm dark:border-border text-text-lm dark:text-text">
                                <Tag className="w-4 h-4 mr-2" /> More from Seller
                            </Button>
                            <Button 
                                className="flex-1 h-12 rounded-xl bg-primary-lm dark:bg-primary text-white font-bold hover:bg-primary-lm/90 dark:hover:bg-primary/90 shadow-lg shadow-primary-lm/20 dark:shadow-none"
                                onClick={() => window.open(item.product_detail_url, '_blank')}
                            >
                                Buy Now <ExternalLink className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </SheetContent>
                </Sheet>
            ))}
        </div>
    );
}

export const parseAliExpressProducts = (rawResponse: any): any[] | string => {
    if (!rawResponse) return [];

    if (typeof rawResponse === 'string' && rawResponse.startsWith('Command(')) {
        return [];
    }

    let jsonString = "";
    if (typeof rawResponse === 'string') {
        const contentMatch = rawResponse.match(/content='([\s\S]*?)'(?=\s|$)/);
        if (contentMatch) {
            jsonString = contentMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        } else {
            const generalMatch = rawResponse.match(/\[[\s\S]*\]/); 
            if (!generalMatch) return [];
            jsonString = generalMatch[0];
        }
    } else {
        if (rawResponse.content) return parseAliExpressProducts(rawResponse.content);
        return Array.isArray(rawResponse) ? rawResponse : [];
    }

    try {
        const parsed = JSON.parse(jsonString);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return jsonString.includes('[') ? rawResponse : [];
    }
};