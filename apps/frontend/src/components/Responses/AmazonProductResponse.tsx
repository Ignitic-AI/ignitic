import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, ShoppingCart, ExternalLink, Truck, TrendingUp, Search, ShieldCheck } from "lucide-react";

interface AmazonProduct {
  asin: string;
  title: string;
  price: number;
  retailPrice?: number;
  imageUrl: string;
  rating: string;
  reviewsCount: number;
  prime: boolean;
  url: string;
  deliveryMessage?: string;
  salesVolume?: string;
  similarKeywords?: string[];
}

export const parseAmazonProducts = (rawResponse: any): any[] | string => {
  if (!rawResponse) return [];

  // Filter out system commands
  if (typeof rawResponse === "string" && rawResponse.startsWith("Command(")) {
    return [];
  }

  let jsonString = "";
  if (typeof rawResponse === "string") {
    const contentMatch = rawResponse.match(/content='([\s\S]*?)'(?=\s|$)/);
    if (contentMatch) {
      // Amazon data often comes in cleaner, but we keep the replace for safety
      jsonString = contentMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    } else {
      const generalMatch = rawResponse.match(/\[[\s\S]*\]/); // Look for array brackets
      if (!generalMatch) return [];
      jsonString = generalMatch[0];
    }
  } else {
    if (rawResponse.content) return parseAmazonProducts(rawResponse.content);
    return Array.isArray(rawResponse) ? rawResponse : [];
  }

  try {
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return jsonString.includes("[") ? rawResponse : [];
  }
};

export function AmazonProductResponse({ products }: { products: AmazonProduct[] }) {
  if (!Array.isArray(products) || products.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-3 font-generalSans text-text-lm dark:text-text" onClick={(e) => e.stopPropagation()}>
      {products.map((item, i) => {
        const discount = item.retailPrice ? Math.round(((item.retailPrice - item.price) / item.retailPrice) * 100) : 0;

        return (
          <Sheet key={item.asin || i}>
            <SheetTrigger asChild>
              <div className="group cursor-pointer flex flex-col bg-bg-light-lm dark:bg-bg-light rounded-xl border border-border-lm dark:border-border overflow-hidden hover:shadow-xl transition-all duration-300">
                {/* Image Wrapper */}
                <div className="aspect-square w-full bg-bg-lm dark:bg-bg flex items-center justify-center p-6 relative overflow-hidden">
                  <img src={item.imageUrl} alt={item.title} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
                  {discount > 0 && (
                    <Badge className="absolute top-3 left-3 bg-red-600 hover:bg-red-700 text-white border-none font-bold">-{discount}%</Badge>
                  )}
                  {item.prime && <div className="absolute top-3 right-3 text-[#00A8E1] font-black italic text-xs">PRIME</div>}
                </div>

                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center text-orange-400">
                      <Star className="w-3 h-3 fill-current" />
                      <span className="text-[11px] font-bold ml-0.5 text-zinc-700 dark:text-zinc-300">{(item.rating || "").split(" ")[0]}</span>
                    </div>
                    <span className="text-[11px] text-zinc-400">({(item.reviewsCount || 0).toLocaleString()})</span>
                  </div>

                  <h3 className="text-[14px] font-medium text-text-lm dark:text-text line-clamp-2 leading-tight mb-3 group-hover:text-primary-lm dark:group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>

                  <div className="mt-auto">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-bold text-text-lm dark:text-text">${item.price}</span>
                      {item.retailPrice && <span className="text-xs text-zinc-400 line-through">${item.retailPrice}</span>}
                    </div>
                    {item.salesVolume && (
                      <div className="flex items-center gap-1 mt-2 text-[11px] text-emerald-600 font-medium">
                        <TrendingUp className="w-3 h-3" />
                        {item.salesVolume}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </SheetTrigger>

            <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col bg-bg-light-lm dark:bg-bg-light border-l border-border-lm dark:border-border font-generalSans">
              <SheetHeader className="px-6 py-4 border-b border-border-lm dark:border-border bg-bg-lm/50 dark:bg-bg/50 sticky top-0 z-10">
                <SheetTitle className="text-xs font-bold uppercase tracking-widest text-text-muted-lm dark:text-text-muted flex items-center gap-2">
                  <ShoppingCart className="w-3 h-3" /> Amazon Marketplace
                </SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="space-y-8">
                  {/* Main Product Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="aspect-square bg-bg-light-lm dark:bg-bg-light border border-border-lm dark:border-border rounded-2xl p-8 flex items-center justify-center shadow-sm">
                      <img src={item.imageUrl} alt="" className="max-h-full max-w-full object-contain" />
                    </div>

                    <div className="flex flex-col justify-center space-y-4">
                      <h2 className="text-xl font-bold text-text-lm dark:text-text leading-snug">{item.title}</h2>

                      <div className="space-y-1">
                        <div className="text-4xl font-black text-text-lm dark:text-text">${item.price}</div>
                        {item.retailPrice && (
                          <p className="text-sm text-zinc-400">
                            List Price: <span className="line-through">${item.retailPrice}</span>
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-4 py-4 border-y border-zinc-100">
                        <div className="text-center border-r pr-4">
                          <div className="text-lg font-bold">{(item.rating || "").split(" ")[0]}</div>
                          <div className="text-[10px] uppercase font-bold text-zinc-400">Rating</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold">{((item.reviewsCount || 0) / 1000).toFixed(1)}k</div>
                          <div className="text-[10px] uppercase font-bold text-zinc-400">Reviews</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Logistics Card */}
                  <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-4">
                    <div className="flex items-start gap-3">
                      <Truck className="w-5 h-5 text-zinc-600 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-bold text-text-lm dark:text-text">Delivery Information</h4>
                        <p className="text-sm text-zinc-500">{item.deliveryMessage || "Check Amazon for specific shipping rates."}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-zinc-600 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-bold text-text-lm dark:text-text">Buyer Protection</h4>
                        <p className="text-sm text-zinc-500">Secure transaction fulfilled by Amazon.</p>
                      </div>
                    </div>
                  </div>

                  {/* Similar Keywords/Tags */}
                  {item.similarKeywords && item.similarKeywords.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4 text-zinc-400">
                        <Search className="w-4 h-4" />
                        <h4 className="text-xs font-bold uppercase tracking-widest">Related Searches</h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.similarKeywords.map((tag) => (
                          <Badge key={tag} variant="outline" className="bg-bg-light-lm dark:bg-bg-light text-text-muted-lm dark:text-text-muted border-border-lm dark:border-border px-3 py-1">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4">
                    <p className="text-[10px] text-zinc-400 uppercase font-bold">ASIN: {item.asin}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-border-lm dark:border-border bg-bg-light-lm dark:bg-bg-light sticky bottom-0 flex gap-3">
                <Button className="flex-1 rounded-xl h-14 bg-primary-lm dark:bg-primary text-white font-bold hover:bg-primary-lm/90 dark:hover:bg-primary/90 shadow-md transition-all" onClick={() => window.open(item.url, "_blank")}>
                  View on Amazon <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        );
      })}
    </div>
  );
}
