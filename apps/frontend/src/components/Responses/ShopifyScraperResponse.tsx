import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
    ExternalLink, 
    Tag, 
    Calendar, 
    Package, 
    Info, 
    ShoppingCart,
    Clock
} from "lucide-react";

interface ShopifyScraperProduct {
    productId: number;
    title: string;
    handle: string;
    productUrl: string;
    vendor: string;
    productType: string;
    createdAt: string;
    updatedAt: string;
    tags: string[];
    descriptionHtml: string;
    variants: any[];
    images: any[];
}

export function ShopifyScraperResponse({ products }: { products: ShopifyScraperProduct[] }) {
    if (!Array.isArray(products) || products.length === 0) return null;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4 font-sans" onClick={(e) => e.stopPropagation()}>
            {products.map((product, i) => {
                const mainImage = product.images?.[0]?.src;
                const firstVariant = product.variants?.[0];
                const price = firstVariant?.price || "0.00";
                const compareAtPrice = firstVariant?.compareAtPrice;
                const isSale = compareAtPrice && parseFloat(compareAtPrice) > parseFloat(price);

                return (
                    <Sheet key={product.productId || i}>
                        <SheetTrigger asChild>
                            <div className="group cursor-pointer flex flex-col bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:shadow-xl transition-all duration-300">
                                <div className="aspect-square w-full bg-zinc-50 flex items-center justify-center relative overflow-hidden p-4">
                                    {mainImage ? (
                                        <img 
                                            src={mainImage} 
                                            alt={product.title} 
                                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" 
                                        />
                                    ) : (
                                        <Package className="w-12 h-12 text-zinc-200" />
                                    )}
                                    {isSale && (
                                        <Badge className="absolute top-3 left-3 bg-red-600 border-none font-bold">SALE</Badge>
                                    )}
                                </div>

                                <div className="p-4 flex flex-col flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-tight px-1.5 py-0">
                                            {product.productType || 'Product'}
                                        </Badge>
                                        <span className="text-[11px] text-zinc-400 font-medium truncate">{product.vendor}</span>
                                    </div>

                                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-tight mb-3 group-hover:text-blue-600 transition-colors">
                                        {product.title}
                                    </h3>

                                    <div className="mt-auto flex items-baseline gap-2">
                                        <span className="text-lg font-black text-zinc-900 dark:text-zinc-50">${price}</span>
                                        {isSale && (
                                            <span className="text-xs text-zinc-400 line-through">${compareAtPrice}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </SheetTrigger>

                        <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col bg-white">
                            <SheetHeader className="px-6 py-4 border-b bg-zinc-50/50 sticky top-0 z-10">
                                <SheetTitle className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                    <ShoppingCart className="w-4 h-4" /> Shopify Store Item
                                </SheetTitle>
                            </SheetHeader>

                            <div className="flex-1 overflow-y-auto p-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div className="aspect-square rounded-2xl border bg-zinc-50 overflow-hidden flex items-center justify-center p-4">
                                            <img src={mainImage} alt="" className="max-h-full max-w-full object-contain" />
                                        </div>
                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                            {product.images?.slice(1, 5).map((img: any, idx: number) => (
                                                <div key={idx} className="w-16 h-16 shrink-0 border rounded-lg overflow-hidden bg-zinc-50">
                                                    <img src={img.src} className="w-full h-full object-cover" alt="" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex flex-col justify-center space-y-4">
                                        <div>
                                            <h2 className="text-2xl font-black text-zinc-900 leading-tight mb-1">{product.title}</h2>
                                            <p className="text-sm font-bold text-zinc-400 uppercase tracking-tighter">{product.vendor}</p>
                                        </div>
                                        
                                        <div className="p-4 rounded-2xl bg-zinc-900 text-white">
                                            <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1">Store Price</div>
                                            <div className="text-3xl font-black">${price}</div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-3 border rounded-xl flex items-center gap-3">
                                                <Calendar className="w-4 h-4 text-zinc-400" />
                                                <div className="min-w-0">
                                                    <p className="text-[9px] font-bold text-zinc-400 uppercase">Created</p>
                                                    <p className="text-xs font-bold truncate">{new Date(product.createdAt).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="p-3 border rounded-xl flex items-center gap-3">
                                                <Clock className="w-4 h-4 text-zinc-400" />
                                                <div className="min-w-0">
                                                    <p className="text-[9px] font-bold text-zinc-400 uppercase">Updated</p>
                                                    <p className="text-xs font-bold truncate">{new Date(product.updatedAt).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {product.variants.length > 1 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-zinc-400">
                                            <Tag className="w-4 h-4" />
                                            <h4 className="text-xs font-bold uppercase tracking-widest">Available Variants</h4>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {product.variants.map((v) => (
                                                <Badge key={v.variantId} variant="secondary" className="px-3 py-1 font-medium bg-zinc-100 text-zinc-700">
                                                    {v.title} — ${v.price}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-zinc-400">
                                        <Info className="w-4 h-4" />
                                        <h4 className="text-xs font-bold uppercase tracking-widest">Product Description</h4>
                                    </div>
                                    <div 
                                        className="prose prose-sm max-w-none text-zinc-600 leading-relaxed border-l-2 border-zinc-100 pl-6"
                                        dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
                                    />
                                </div>

                                {product.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-4 border-t">
                                        {product.tags.map((tag) => (
                                            <span key={tag} className="text-[10px] font-bold text-zinc-400 uppercase">#{tag}</span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t bg-white sticky bottom-0">
                                <Button 
                                    className="w-full h-12 bg-zinc-900 text-white font-bold rounded-xl hover:bg-zinc-800 shadow-lg"
                                    onClick={() => window.open(product.productUrl, '_blank')}
                                >
                                    Visit Original Product <ExternalLink className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </SheetContent>
                    </Sheet>
                );
            })}
        </div>
    );
}

export const parseShopifyScraperProducts = (rawResponse: any): any[] | string => {
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
        if (rawResponse.content) return parseShopifyScraperProducts(rawResponse.content);
        return Array.isArray(rawResponse) ? rawResponse : [];
    }

    try {
        const parsed = JSON.parse(jsonString);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return jsonString.includes('[') ? rawResponse : [];
    }
};