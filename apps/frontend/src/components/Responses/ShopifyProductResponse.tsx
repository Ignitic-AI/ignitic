import React from 'react';
import { 
  ExternalLink, 
  MessageCircle, 
  Send, 
  CheckCircle2, 
  Star, 
  Info 
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Shopify Data Parser
 * Converts raw Shopify GraphQL response (string or object) into 
 * a clean array of product nodes for the UI.
 */
export const parseShopifyProducts = (rawResponse: any): any[] | string => {
    if (!rawResponse) return [];

    let jsonString = "";

    if (typeof rawResponse === 'string') {
        // 1. Try to extract what is inside the content='...' quotes
        const contentMatch = rawResponse.match(/content='([\s\S]*?)'(?=\s|$)/);
        
        if (contentMatch) {
            // Unescape the backslashes (e.g., \" becomes ")
            jsonString = contentMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        } else {
            // Fallback to your original regex if content='' isn't found
            const generalMatch = rawResponse.match(/\{[\s\S]*\}/);
            jsonString = generalMatch ? generalMatch[0] : rawResponse;
        }
    } else {
        // If it's already an object, check if it has a .content property
        if (rawResponse.content) return parseShopifyProducts(rawResponse.content);
        return Array.isArray(rawResponse) ? rawResponse : [];
    }

    try {
        const parsed = JSON.parse(jsonString);
        
        // 2. Drill down into the Shopify GraphQL structure
        const products = 
            parsed?.data?.products?.edges || 
            parsed?.products?.edges || 
            parsed?.edges;

        if (Array.isArray(products)) {
            return products;
        }
        
        // If it parsed but isn't an array, return the parsed object or empty
        return [];
    } catch (error) {
        // If parsing still fails, return the string so you can see the error in UI
        return rawResponse; 
    }
};

interface ShopifyProductResponseProps {
  products: any[];
}

export function ShopifyProductResponse({ products }: ShopifyProductResponseProps) {
    if (!Array.isArray(products) || products.length === 0) {
    // If it's a string (error message), you might want to show it or just return null
    if (typeof products === 'string') console.error("Parser returned an error string:", products);
    return null;
}

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-3 font-generalSans" onClick={(e) => e.stopPropagation()}>
            {products.map((item: any, i: number) => {
                const prod = item.node;
                
                // Data Extraction
                const price = prod.priceRangeV2?.minVariantPrice?.amount || '0.00';
                const currency = prod.priceRangeV2?.minVariantPrice?.currencyCode || 'USD';
                const mainImage = prod.featuredImage?.url;
                const altText = prod.featuredImage?.altText || prod.title;
                const allImages = prod.images?.edges?.map((e: any) => e.node) || (mainImage ? [{ url: mainImage }] : []);
                
                // Logic-based Display Attributes
                const isVerified = !!prod.vendor;
                const hasStock = prod.totalInventory > 0;

                return (
                    <Sheet key={prod.id || i}>
                        {/* THE CARD (TRIGGER) */}
                        <SheetTrigger asChild>
                            <div className="group cursor-pointer flex flex-col bg-bg-light-lm dark:bg-bg-light rounded-xl border border-border-lm dark:border-border overflow-hidden hover:shadow-xl transition-all duration-300">
                                <div className="aspect-square w-full bg-bg-lm dark:bg-bg flex items-center justify-center p-4 relative">
                                    {mainImage ? (
                                        <img src={mainImage} alt={altText} className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal group-hover:scale-105 transition-transform duration-500" />
                                    ) : (
                                        <div className="text-text-muted-lm dark:text-text-muted text-xs">No Image Available</div>
                                    )}
                                </div>

                                <div className="p-4 flex flex-col flex-1">
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <Badge variant="outline" className="bg-primary-lm/10 dark:bg-primary/10 text-primary-lm dark:text-primary border-primary-lm/20 dark:border-primary/20 px-1 py-0 text-[10px] uppercase">
                                            {prod.productType || 'Product'}
                                        </Badge>
                                        <span className="text-[12px] text-text-muted-lm dark:text-text-muted font-medium truncate">{prod.vendor}</span>
                                    </div>

                                    <h3 className="text-[15px] font-semibold text-text-lm dark:text-text line-clamp-2 leading-tight mb-2 group-hover:text-primary-lm dark:group-hover:text-primary transition-colors">
                                        {prod.title}
                                    </h3>

                                    <div className="mt-auto space-y-1">
                                        <div className="text-xl font-bold text-text-lm dark:text-text">${price}</div>
                                        <p className="text-[12px] text-text-muted-lm dark:text-text-muted">{hasStock ? 'Min. order: 1 unit' : 'Check Availability'}</p>
                                    </div>
                                </div>
                            </div>
                        </SheetTrigger>

                        {/* SIDE SHEET DETAIL VIEW */}
                        <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0 flex flex-col bg-bg-light-lm dark:bg-bg-light border-l border-border-lm dark:border-border">
                            <SheetHeader className="px-6 py-4 border-b border-border-lm dark:border-border bg-bg-light-lm dark:bg-bg-light sticky top-0 z-10">
                                <SheetTitle className="text-lg font-bold text-text-lm dark:text-text">Product details</SheetTitle>
                            </SheetHeader>
                            
                            <div className="flex-1 overflow-y-auto">
                                <div className="p-6">
                                    <div className="mb-6">
                                        <h2 className="text-2xl font-bold text-text-lm dark:text-text mb-2">{prod.title}</h2>
                                        <div className="flex items-center gap-3 text-sm text-text-muted-lm dark:text-text-muted">
                                            <span className="font-bold text-text-lm dark:text-text uppercase tracking-tight">{prod.vendor}</span>
                                            {isVerified && (
                                                <span className="flex items-center text-primary-lm dark:text-primary text-xs font-bold px-2 py-0.5 bg-primary-lm/10 dark:bg-primary/10 rounded-full">
                                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Verified
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <div className="aspect-square bg-bg-lm dark:bg-bg rounded-xl border border-border-lm dark:border-border flex items-center justify-center p-8">
                                                <img src={mainImage} alt="" className="max-h-full max-w-full object-contain mix-blend-multiply dark:mix-blend-normal" />
                                            </div>
                                            <div className="flex gap-2 overflow-x-auto pb-2">
                                                {allImages.map((img: any, idx: number) => (
                                                    <div key={idx} className="w-16 h-16 shrink-0 border border-border-lm dark:border-border rounded-md p-1 flex items-center justify-center bg-bg-lm dark:bg-bg hover:border-primary-lm dark:hover:border-primary cursor-pointer">
                                                        <img src={img.url} alt="" className="max-h-full max-w-full object-contain mix-blend-multiply dark:mix-blend-normal" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="bg-bg-lm dark:bg-bg p-6 rounded-xl border border-border-lm dark:border-border">
                                                <div className="text-sm text-text-muted-lm dark:text-text-muted mb-1">≥1 Unit</div>
                                                <div className="text-4xl font-bold text-text-lm dark:text-text mb-4">${price} <span className="text-sm font-normal text-text-muted-lm dark:text-text-muted">{currency}</span></div>
                                                <div className="space-y-3 text-sm border-t border-border-lm dark:border-border pt-4">
                                                    <div className="flex justify-between">
                                                        <span className="text-text-muted-lm dark:text-text-muted">Shipping</span>
                                                        <span className="font-medium text-text-lm dark:text-text">Calculated at checkout</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-text-muted-lm dark:text-text-muted flex items-center">MSRP <Info className="w-3 h-3 ml-1" /></span>
                                                        <span className="text-text-muted-lm dark:text-text-muted line-through">${(parseFloat(price) * 1.2).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {prod.tags?.length > 0 && (
                                                <div>
                                                    <span className="block font-bold text-[13px] mb-3 uppercase text-text-muted-lm dark:text-text-muted">Key Specifications</span>
                                                    <div className="flex flex-wrap gap-2">
                                                        {prod.tags.map((tag: string) => (
                                                            <Badge key={tag} variant="secondary" className="bg-bg-lm dark:bg-bg text-text-lm dark:text-text border border-border-lm dark:border-border px-3 py-1 font-medium">
                                                                {tag}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-12 pt-8 border-t border-border-lm dark:border-border">
                                        <h4 className="text-lg font-bold mb-4 text-text-lm dark:text-text">Description</h4>
                                        <div 
                                            className="prose prose-sm max-w-none text-text-muted-lm dark:text-text-muted leading-relaxed"
                                            dangerouslySetInnerHTML={{ __html: prod.descriptionHtml || prod.description || "Detailed specifications not provided." }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* FOOTER ACTIONS */}
                            <div className="p-4 border-t border-border-lm dark:border-border bg-bg-light-lm dark:bg-bg-light sticky bottom-0 flex gap-4">
                                <Button variant="outline" className="flex-1 rounded-md h-10 font-bold border-border-lm dark:border-border text-text-lm dark:text-text hover:bg-bg-lm dark:hover:bg-bg">
                                    <MessageCircle className="w-5 h-5 mr-2" /> Chat now
                                </Button>
                                <Button className="flex-1 rounded-md h-10 bg-primary-lm dark:bg-primary text-white font-bold hover:bg-primary-lm/90 dark:hover:bg-primary/90">
                                    Send inquiry
                                </Button>
                            </div>
                        </SheetContent>
                    </Sheet>
                );
            })}
        </div>
    );
}