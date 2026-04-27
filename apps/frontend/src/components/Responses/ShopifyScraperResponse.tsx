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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4 font-generalSans text-text-lm dark:text-text" onClick={(e) => e.stopPropagation()}>
            {products.map((product, i) => {
                const mainImage = product.images?.[0]?.src;
                const firstVariant = product.variants?.[0];
                const price = firstVariant?.price || "0.00";
                const compareAtPrice = firstVariant?.compareAtPrice;
                const isSale = compareAtPrice && parseFloat(compareAtPrice) > parseFloat(price);

                return (
                    <Sheet key={product.productId || i}>
                        <SheetTrigger asChild>
                            <div className="group cursor-pointer flex flex-col bg-bg-light-lm dark:bg-bg-light rounded-xl border border-border-lm dark:border-border overflow-hidden hover:shadow-xl transition-all duration-300">
                                <div className="aspect-square w-full bg-bg-lm dark:bg-bg flex items-center justify-center relative overflow-hidden p-4">
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
                                        <span className="text-[11px] text-text-muted-lm dark:text-text-muted font-medium truncate">{product.vendor}</span>
                                    </div>

                                    <h3 className="text-sm font-bold text-text-lm dark:text-text line-clamp-2 leading-tight mb-3 group-hover:text-primary-lm dark:group-hover:text-primary transition-colors">
                                        {product.title}
                                    </h3>

                                    <div className="mt-auto flex items-baseline gap-2">
                                        <span className="text-lg font-black text-text-lm dark:text-text">${price}</span>
                                        {isSale && (
                                            <span className="text-xs text-text-muted-lm dark:text-text-muted line-through">${compareAtPrice}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </SheetTrigger>

                        <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col bg-bg-light-lm dark:bg-bg-light border-l border-border-lm dark:border-border font-generalSans">
                            <SheetHeader className="px-6 py-4 border-b border-border-lm dark:border-border bg-bg-lm/50 dark:bg-bg/50 sticky top-0 z-10">
                                <SheetTitle className="text-xs font-bold uppercase tracking-widest text-text-muted-lm dark:text-text-muted flex items-center gap-2">
                                    <ShoppingCart className="w-4 h-4" /> Shopify Store Item
                                </SheetTitle>
                            </SheetHeader>

                            <div className="flex-1 overflow-y-auto p-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div className="aspect-square rounded-2xl border border-border-lm dark:border-border bg-bg-lm dark:bg-bg overflow-hidden flex items-center justify-center p-4">
                                            <img src={mainImage} alt="" className="max-h-full max-w-full object-contain" />
                                        </div>
                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                            {product.images?.slice(1, 5).map((img: any, idx: number) => (
                                                <div key={idx} className="w-16 h-16 shrink-0 border border-border-lm dark:border-border rounded-lg overflow-hidden bg-bg-lm dark:bg-bg">
                                                    <img src={img.src} className="w-full h-full object-cover" alt="" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex flex-col justify-center space-y-4">
                                        <div>
                                            <h2 className="text-2xl font-black text-text-lm dark:text-text leading-tight mb-1">{product.title}</h2>
                                            <p className="text-sm font-bold text-text-muted-lm dark:text-text-muted uppercase tracking-tighter">{product.vendor}</p>
                                        </div>
                                        
                                        <div className="p-4 rounded-2xl bg-bg dark:bg-bg-dark text-text dark:text-white">
                                            <div className="text-[10px] uppercase font-bold text-text-muted-lm dark:text-text-muted mb-1">Store Price</div>
                                            <div className="text-3xl font-black">${price}</div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-3 border border-border-lm dark:border-border rounded-xl flex items-center gap-3">
                                                <Calendar className="w-4 h-4 text-text-muted-lm dark:text-text-muted" />
                                                <div className="min-w-0">
                                                    <p className="text-[9px] font-bold text-text-muted-lm dark:text-text-muted uppercase">Created</p>
                                                    <p className="text-xs font-bold truncate text-text-lm dark:text-text">{new Date(product.createdAt).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="p-3 border border-border-lm dark:border-border rounded-xl flex items-center gap-3">
                                                <Clock className="w-4 h-4 text-text-muted-lm dark:text-text-muted" />
                                                <div className="min-w-0">
                                                    <p className="text-[9px] font-bold text-text-muted-lm dark:text-text-muted uppercase">Updated</p>
                                                    <p className="text-xs font-bold truncate text-text-lm dark:text-text">{new Date(product.updatedAt).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {product.variants.length > 1 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-text-muted-lm dark:text-text-muted">
                                            <Tag className="w-4 h-4" />
                                            <h4 className="text-xs font-bold uppercase tracking-widest">Available Variants</h4>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {product.variants.map((v) => (
                                                <Badge key={v.variantId} variant="secondary" className="px-3 py-1 font-medium bg-bg-lm dark:bg-bg text-text-lm dark:text-text">
                                                    {v.title} — ${v.price}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-text-muted-lm dark:text-text-muted">
                                        <Info className="w-4 h-4" />
                                        <h4 className="text-xs font-bold uppercase tracking-widest">Product Description</h4>
                                    </div>
                                    <div 
                                        className="prose prose-sm max-w-none text-text-muted-lm dark:text-text-muted leading-relaxed border-l-2 border-border-lm dark:border-border pl-6"
                                        dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
                                    />
                                </div>

                                {product.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-4 border-t">
                                        {product.tags.map((tag) => (
                                            <span key={tag} className="text-[10px] font-bold text-text-muted-lm dark:text-text-muted uppercase">#{tag}</span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t border-border-lm dark:border-border bg-bg-light-lm dark:bg-bg-light sticky bottom-0">
                                <Button 
                                    className="w-full h-12 bg-primary-lm dark:bg-primary text-white font-bold rounded-xl hover:bg-primary-lm/90 dark:hover:bg-primary/90 shadow-lg"
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