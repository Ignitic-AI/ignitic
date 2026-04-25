import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, MessageCircle, ShoppingBag, Layers } from "lucide-react";

interface Props {
  product: any;
}

export const parseShopifySingleProduct = (rawResponse: any): any | string => {
  if (!rawResponse) return null;

  // Filter out system commands
  if (typeof rawResponse === "string" && rawResponse.startsWith("Command(")) {
    return null;
  }

  let jsonString = "";
  if (typeof rawResponse === "string") {
    const contentMatch = rawResponse.match(/content='([\s\S]*?)'(?=\s|$)/);
    if (contentMatch) {
      jsonString = contentMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    } else {
      const generalMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!generalMatch) return null;
      jsonString = generalMatch[0];
    }
  } else {
    if (rawResponse.content) return parseShopifySingleProduct(rawResponse.content);
    return rawResponse;
  }

  try {
    const parsed = JSON.parse(jsonString);
    // Drill down to the single product object
    const product = parsed?.data?.product || parsed?.product;
    return product || null;
  } catch (error) {
    return jsonString.includes("{") ? rawResponse : null;
  }
};

export function ShopifySingleProductResponse({ product }: Props) {
  if (!product || typeof product === "string") return null;

  // Data Extraction
  const price = product.priceRangeV2?.minVariantPrice?.amount || "0.00";
  const currency = product.priceRangeV2?.minVariantPrice?.currencyCode || "USD";
  const mainImage = product.featuredImage?.url;
  const images = product.images?.edges?.map((e: any) => e.node) || [];
  const gallery = images.length > 0 ? images : mainImage ? [{ url: mainImage }] : [];

  // Logic-based attributes
  const hasVariants = product.variants?.edges?.length > 1;
  const totalVariants = product.variants?.edges?.length || 0;
  const isVerified = !!product.vendor;

  return (
    <div className="mt-4 max-w-lg" onClick={(e) => e.stopPropagation()}>
      <Sheet>
        <SheetTrigger asChild>
          <div className="group cursor-pointer bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:shadow-2xl transition-all duration-500 flex flex-col md:flex-row">
            {/* Image Section */}
            <div className="md:w-2/5 aspect-square bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center p-6">
              {mainImage ? (
                <img
                  src={mainImage}
                  alt={product.title}
                  className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal group-hover:scale-110 transition-transform duration-700"
                />
              ) : (
                <div className="text-zinc-400 text-xs">No Image</div>
              )}
            </div>

            {/* Content Preview */}
            <div className="p-6 flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none text-[10px] uppercase font-bold">
                  {product.productType || "Product"}
                </Badge>
                <span className="text-xs text-zinc-400 font-medium">{product.vendor}</span>
              </div>

              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2 group-hover:text-blue-600 transition-colors">
                {product.title}
              </h3>

              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-2xl font-black text-zinc-900 dark:text-zinc-50">${price}</span>
                <span className="text-xs text-zinc-400 uppercase font-semibold">{currency}</span>
              </div>

              <div className="flex items-center gap-4 text-xs text-zinc-500 border-t pt-4">
                <div className="flex items-center gap-1">
                  <ShoppingBag className="w-3 h-3" />
                  <span>{product.status}</span>
                </div>
                {hasVariants && (
                  <div className="flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    <span>{totalVariants} options</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </SheetTrigger>

        <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0 flex flex-col bg-white">
          <SheetHeader className="px-6 py-4 border-b bg-white sticky top-0 z-10">
            <SheetTitle className="text-lg font-bold">Product Specification</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Left: Gallery */}
              <div className="space-y-4">
                <div className="aspect-square bg-zinc-50 rounded-2xl border flex items-center justify-center p-10">
                  <img src={mainImage} alt="" className="max-h-full max-w-full object-contain" />
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {gallery.map((img: any, idx: number) => (
                    <div
                      key={idx}
                      className="w-20 h-20 shrink-0 border rounded-xl p-2 flex items-center justify-center bg-white hover:border-blue-500 cursor-pointer transition-colors"
                    >
                      <img src={img.url} alt="" className="max-h-full max-w-full object-contain" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Info */}
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-black text-zinc-900 mb-2 leading-tight">{product.title}</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-zinc-500 uppercase tracking-widest">{product.vendor}</span>
                    {isVerified && (
                      <span className="flex items-center text-blue-600 text-[10px] font-bold px-2 py-0.5 bg-blue-50 rounded-full uppercase">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Brand Verified
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-zinc-900 text-white p-6 rounded-2xl">
                  <div className="text-xs text-zinc-400 mb-1 uppercase font-bold tracking-tighter">Current Price</div>
                  <div className="text-4xl font-black">
                    ${price} <span className="text-sm font-normal text-zinc-500">{currency}</span>
                  </div>
                </div>

                {/* Variants Section */}
                {product.options?.map((option: any) => (
                  <div key={option.id}>
                    <span className="block font-bold text-[12px] mb-3 uppercase text-zinc-400 tracking-widest">{option.name}</span>
                    <div className="flex flex-wrap gap-2">
                      {option.optionValues?.map((val: any) => (
                        <Badge key={val.id} variant="outline" className="px-4 py-2 rounded-lg border-zinc-200 text-zinc-700 hover:border-zinc-900 cursor-default">
                          {val.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Description */}
                <div className="pt-6 border-t border-zinc-100">
                  <h4 className="font-bold text-zinc-900 mb-4 uppercase text-xs tracking-widest">Product Overview</h4>
                  <div
                    className="text-zinc-600 text-sm leading-relaxed prose prose-zinc"
                    dangerouslySetInnerHTML={{ __html: product.descriptionHtml || "No detailed description available." }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-t bg-white sticky bottom-0 flex gap-4">
            <Button variant="outline" className="flex-1 rounded-xl h-14 font-bold border-zinc-200 hover:bg-zinc-50">
              <MessageCircle className="w-5 h-5 mr-2" /> Inquiry
            </Button>
            <Button className="flex-1 rounded-xl h-14 bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-100">
              View on Store
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
