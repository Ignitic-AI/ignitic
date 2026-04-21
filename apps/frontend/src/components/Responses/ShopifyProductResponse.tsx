import React from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

export function ShopifyProductResponse({ products }: { products: any[] }) {
    console.log("[ShopifyProductResponse] Rendering Shopify products block", products);
    if (!products || products.length === 0) return null;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3 font-generalSans" onClick={(e) => e.stopPropagation()}>
            {products.map((item: any, i: number) => {
                const prod = item.node;
                const price = prod.priceRangeV2?.minVariantPrice?.amount || '0.00';
                
                // If the backend provides an array of images, map them, otherwise fallback to featuredImage
                const images = prod.images?.edges?.map((e: any) => e.node) || [];
                if (images.length === 0 && prod.featuredImage) {
                    images.push(prod.featuredImage);
                }

                return (
                    <Sheet key={prod.id || i}>
                        <SheetTrigger asChild>
                            <div className="flex flex-col bg-bg-lm dark:bg-bg rounded-[4px] border border-border-lm dark:border-border p-0 hover:shadow-lg transition-all group cursor-pointer overflow-hidden pb-4 h-full">
                                <div className="h-48 w-full bg-bg-light-lm dark:bg-bg-light border-b border-border-lm dark:border-border flex items-center justify-center relative shrink-0">
                                    {prod.featuredImage?.url ? (
                                        <img src={prod.featuredImage.url} alt={prod.title} className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal p-2" />
                                    ) : (
                                        <FileText className="w-12 h-12 text-text-muted-lm dark:text-text-muted opacity-50" />
                                    )}
                                </div>
                                <div className="p-3 pb-0 flex flex-col flex-1">
                                    {prod.vendor && (
                                        <div className="flex items-center space-x-1 text-[11px] text-text-muted-lm dark:text-text-muted mb-1.5 font-medium items-baseline uppercase">
                                            <span className="text-primary-lm dark:text-primary font-semibold flex items-center capitalize">{prod.vendor}</span>
                                        </div>
                                    )}
                                    <p className="text-[14px] font-medium line-clamp-2 group-hover:text-primary-lm dark:group-hover:text-primary leading-snug text-text-lm dark:text-text mb-2">
                                        {prod.title}
                                    </p>
                                    <div className="mt-auto flex flex-col pt-2">
                                        <span className="text-lg font-bold text-text-lm dark:text-text">${price}</span>
                                    </div>
                                </div>
                            </div>
                        </SheetTrigger>

                        {/* SHEET CONTENT */}
                        <SheetContent side="right" className="w-[90vw] sm:max-w-2xl lg:max-w-4xl p-0 font-generalSans bg-bg-lm dark:bg-bg border-l border-border-lm dark:border-border overflow-hidden flex flex-col rounded-l-[4px]">
                            <SheetHeader className="px-6 py-4 flex flex-row space-y-0 items-center border-b border-border-lm dark:border-border shrink-0">
                                <SheetTitle className="text-lg font-bold text-text-lm dark:text-text font-generalSans">Product details</SheetTitle>
                            </SheetHeader>
                            
                            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                                {/* Subtitle / Vendor link */}
                                <div className="mb-6">
                                    {prod.onlineStoreUrl ? (
                                        <a href={prod.onlineStoreUrl} target="_blank" rel="noopener noreferrer" className="text-xl font-medium hover:underline flex items-center text-text-lm dark:text-text mb-2 group">
                                            {prod.title} <ExternalLink className="w-5 h-5 ml-2 opacity-50 group-hover:opacity-100 transition-opacity" />
                                        </a>
                                    ) : (
                                        <div className="text-xl font-medium flex items-center text-text-lm dark:text-text mb-2">
                                            {prod.title}
                                        </div>
                                    )}
                                    {prod.vendor && (
                                        <div className="flex items-center text-sm text-text-muted-lm dark:text-text-muted flex-wrap gap-y-2">
                                            <span className="mr-2">Supplier:</span>
                                            <span className="text-primary-lm dark:text-primary font-semibold flex items-center mr-2">{prod.vendor}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col lg:flex-row gap-8">
                                    {/* Left col - Images */}
                                    <div className="w-full lg:w-[45%] flex flex-col">
                                        <div className="bg-bg-light-lm dark:bg-bg-light rounded-[4px] p-4 w-full flex items-center justify-center border border-border-lm dark:border-border aspect-[4/3] relative">
                                            {prod.featuredImage?.url ? (
                                                <img src={prod.featuredImage.url} alt={prod.title} className="max-h-full max-w-full object-contain mix-blend-multiply dark:mix-blend-normal" />
                                            ) : (
                                                <FileText className="w-24 h-24 text-text-muted-lm dark:text-text-muted opacity-50" />
                                            )}
                                        </div>
                                        {images.length > 1 && (
                                            <div className="flex gap-2 mt-4 overflow-x-auto w-full pb-2">
                                                {images.map((img: any, idx: number) => (
                                                    <div key={idx} className="w-16 h-16 shrink-0 border border-border-lm dark:border-border rounded-[4px] cursor-pointer hover:border-primary-lm dark:hover:border-primary overflow-hidden flex items-center justify-center bg-bg-light-lm dark:bg-bg-light">
                                                        <img src={img.url} alt="" className="max-h-full max-w-full object-contain mix-blend-multiply dark:mix-blend-normal p-1" />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Right col - Details */}
                                    <div className="w-full lg:w-[55%] flex flex-col h-full">
                                        <div className="mb-6">
                                            <div className="text-xs text-text-muted-lm dark:text-text-muted uppercase tracking-wider mb-2 font-semibold">Price</div>
                                            <div className="text-3xl font-bold text-text-lm dark:text-text">${price}</div>
                                        </div>
                                        
                                        {/* Product Description if available */}
                                        {prod.descriptionHtml && (
                                            <div className="mb-6 pt-6 border-t border-border-lm dark:border-border">
                                                <div className="text-xs text-text-muted-lm dark:text-text-muted uppercase tracking-wider mb-2 font-semibold">Description</div>
                                                <div 
                                                    className="prose prose-sm dark:prose-invert text-text-lm dark:text-text"
                                                    dangerouslySetInnerHTML={{ __html: prod.descriptionHtml }}
                                                />
                                            </div>
                                        )}

                                        {!prod.descriptionHtml && prod.description && (
                                            <div className="mb-6 pt-6 border-t border-border-lm dark:border-border">
                                                <div className="text-xs text-text-muted-lm dark:text-text-muted uppercase tracking-wider mb-2 font-semibold">Description</div>
                                                <p className="text-sm text-text-lm dark:text-text whitespace-pre-wrap">{prod.description}</p>
                                            </div>
                                        )}
                                        
                                        {prod.onlineStoreUrl && (
                                            <div className="mt-auto flex gap-3 pt-6 border-t border-border-lm dark:border-border items-center pb-6">
                                                <Button asChild className="w-full rounded-md h-12 text-[15px] font-semibold bg-text-lm dark:bg-text text-bg-lm dark:text-bg hover:opacity-90 font-generalSans">
                                                    <a href={prod.onlineStoreUrl} target="_blank" rel="noopener noreferrer">
                                                        View on Store
                                                    </a>
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                );
            })}
        </div>
    );
}

export default ShopifyProductResponse;
