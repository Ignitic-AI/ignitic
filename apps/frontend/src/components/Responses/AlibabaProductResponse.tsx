import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Package, ExternalLink, ShieldCheck, Award, TrendingUp, MessageSquare } from "lucide-react";

interface AlibabaProduct {
  name: string;
  price_min: number;
  price_max: number;
  currency: string;
  moq: number;
  product_url: string;
  main_image: string;
  company_name: string;
  years_as_gold_supplier: number;
  supplier_service_score: number;
  is_verified_supplier: boolean;
  review_count: number;
  review_score: number;
  orders_count: number | null;
}

export const parseAlibabaProducts = (rawResponse: any): any[] | string => {
  if (!rawResponse) return [];

  // Filter out system commands
  if (typeof rawResponse === "string" && rawResponse.startsWith("Command(")) {
    return [];
  }

  let jsonString = "";
  if (typeof rawResponse === "string") {
    const contentMatch = rawResponse.match(/content='([\s\S]*?)'(?=\s|$)/);
    if (contentMatch) {
      jsonString = contentMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    } else {
      const generalMatch = rawResponse.match(/\[[\s\S]*\]/);
      if (!generalMatch) return [];
      jsonString = generalMatch[0];
    }
  } else {
    if (rawResponse.content) return parseAlibabaProducts(rawResponse.content);
    return Array.isArray(rawResponse) ? rawResponse : [];
  }

  try {
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return jsonString.includes("[") ? rawResponse : [];
  }
};

export function AlibabaProductResponse({ products }: { products: AlibabaProduct[] }) {
  if (!Array.isArray(products) || products.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4 font-sans" onClick={(e) => e.stopPropagation()}>
      {products.map((item, i) => {
        const hasPriceRange = item.price_min !== item.price_max;
        const displayPrice = hasPriceRange ? `${item.price_min.toFixed(2)} - ${item.price_max.toFixed(2)}` : item.price_min.toFixed(2);

        return (
          <Sheet key={i}>
            <SheetTrigger asChild>
              <div className="group cursor-pointer flex flex-col bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:shadow-xl transition-all duration-300">
                {/* Product Image */}
                <div className="aspect-square w-full bg-zinc-50 flex items-center justify-center relative">
                  <img src={item.main_image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute bottom-2 left-2">
                    <Badge className="bg-black/60 backdrop-blur-md text-white border-none text-[10px] py-0 px-1.5">MOQ: {item.moq} pcs</Badge>
                  </div>
                </div>

                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Badge className="bg-orange-50 text-orange-600 border-orange-100 text-[9px] font-bold px-1 py-0 uppercase">
                      {item.years_as_gold_supplier} Yrs Gold
                    </Badge>
                    {item.is_verified_supplier && <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />}
                  </div>

                  <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-snug mb-3 group-hover:text-orange-600 transition-colors">
                    {item.name}
                  </h3>

                  <div className="mt-auto">
                    <div className="text-lg font-black text-zinc-900 dark:text-zinc-50">
                      ${displayPrice} <span className="text-[10px] font-normal text-zinc-400">/{item.currency}</span>
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-1 truncate">{item.company_name}</div>
                  </div>
                </div>
              </div>
            </SheetTrigger>

            <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col bg-white">
              <SheetHeader className="px-6 py-4 border-b bg-zinc-50/50 sticky top-0 z-10">
                <SheetTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Wholesale Product Detail</SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Hero Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="aspect-square rounded-2xl border bg-zinc-50 overflow-hidden">
                    <img src={item.main_image} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col justify-center">
                    <h2 className="text-xl font-bold text-zinc-900 leading-tight mb-4">{item.name}</h2>
                    <div className="space-y-1">
                      <div className="text-3xl font-black text-orange-600">${displayPrice}</div>
                      <p className="text-xs text-zinc-400 font-bold uppercase">Price per unit ({item.currency})</p>
                    </div>
                    <div className="mt-6 p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                      <div className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Minimum Order</div>
                      <div className="text-lg font-bold text-zinc-900">{item.moq} Units</div>
                    </div>
                  </div>
                </div>

                {/* Supplier Trust Signals */}
                <div className="p-6 rounded-2xl border-2 border-orange-50 bg-orange-50/30">
                  <div className="flex items-center gap-2 mb-4">
                    <Award className="w-5 h-5 text-orange-500" />
                    <h4 className="font-bold text-zinc-900 uppercase text-xs tracking-wider">Supplier Information</h4>
                  </div>
                  <div className="space-y-4">
                    <div className="font-bold text-zinc-800">{item.company_name}</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-3 rounded-lg shadow-sm border border-orange-100">
                        <div className="text-[10px] text-zinc-400 font-bold uppercase">Gold Supplier</div>
                        <div className="text-sm font-bold text-orange-600">{item.years_as_gold_supplier} Years</div>
                      </div>
                      <div className="bg-white p-3 rounded-lg shadow-sm border border-orange-100">
                        <div className="text-[10px] text-zinc-400 font-bold uppercase">Service Score</div>
                        <div className="text-sm font-bold text-orange-600">{item.supplier_service_score} / 5.0</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Operational Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <TrendingUp className="w-4 h-4 mx-auto mb-2 text-zinc-300" />
                    <div className="text-[10px] font-bold text-zinc-400 uppercase">Total Orders</div>
                    <div className="text-sm font-bold">{item.orders_count?.toLocaleString() || "New"}</div>
                  </div>
                  <div className="text-center">
                    <Star className="w-4 h-4 mx-auto mb-2 text-zinc-300" />
                    <div className="text-[10px] font-bold text-zinc-400 uppercase">Reviews</div>
                    <div className="text-sm font-bold">{item.review_count}</div>
                  </div>
                  <div className="text-center">
                    <Package className="w-4 h-4 mx-auto mb-2 text-zinc-300" />
                    <div className="text-[10px] font-bold text-zinc-400 uppercase">Rating</div>
                    <div className="text-sm font-bold">{item.review_score}</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 border-t bg-white sticky bottom-0 flex gap-3">
                <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold border-zinc-200">
                  <MessageSquare className="w-4 h-4 mr-2" /> Chat with Supplier
                </Button>
                <Button className="flex-1 h-12 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 shadow-lg shadow-orange-200" onClick={() => window.open(item.product_url, "_blank")}>
                  Source Now <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        );
      })}
    </div>
  );
}
