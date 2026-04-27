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
    <div className="mt-4 max-w-lg font-generalSans text-text-lm dark:text-text" onClick={(e) => e.stopPropagation()}>
      <Sheet>
        <SheetTrigger asChild>
          <div className="group cursor-pointer bg-bg-light-lm dark:bg-bg-light rounded-2xl border border-border-lm dark:border-border overflow-hidden hover:shadow-2xl transition-all duration-500 flex flex-col md:flex-row">
            {/* Image Section */}
            <div className="md:w-2/5 aspect-square bg-bg-lm dark:bg-bg flex items-center justify-center p-6">
              {mainImage ? (
                <img
                  src={mainImage}
                  alt={product.title}
                  className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal group-hover:scale-110 transition-transform duration-700"
                />
              ) : (
                <div className="text-text-muted-lm dark:text-text-muted text-xs">No Image</div>
              )}
            </div>

            {/* Content Preview */}
            <div className="p-6 flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary" className="bg-primary-lm/10 dark:bg-primary/10 text-primary-lm dark:text-primary border-none text-[10px] uppercase font-bold">
                  {product.productType || "Product"}
                </Badge>
                <span className="text-xs text-text-muted-lm dark:text-text-muted font-medium">{product.vendor}</span>
              </div>

              <h3 className="text-xl font-bold text-text-lm dark:text-text mb-2 group-hover:text-primary-lm dark:group-hover:text-primary transition-colors">
                {product.title}
              </h3>

              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-2xl font-black text-text-lm dark:text-text">${price}</span>
                <span className="text-xs text-text-muted-lm dark:text-text-muted uppercase font-semibold">{currency}</span>
              </div>

              <div className="flex items-center gap-4 text-xs text-text-muted-lm dark:text-text-muted border-t border-border-lm dark:border-border pt-4">
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

        <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0 flex flex-col bg-bg-light-lm dark:bg-bg-light border-l border-border-lm dark:border-border font-generalSans">
          <SheetHeader className="px-6 py-4 border-b border-border-lm dark:border-border bg-bg-light-lm dark:bg-bg-light sticky top-0 z-10">
            <SheetTitle className="text-lg font-bold text-text-lm dark:text-text">Product Specification</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Left: Gallery */}
              <div className="space-y-4">
                <div className="aspect-square bg-bg-lm dark:bg-bg rounded-2xl border border-border-lm dark:border-border flex items-center justify-center p-10">
                  <img src={mainImage} alt="" className="max-h-full max-w-full object-contain" />
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {gallery.map((img: any, idx: number) => (
                    <div
                      key={idx}
                      className="w-20 h-20 shrink-0 border border-border-lm dark:border-border rounded-xl p-2 flex items-center justify-center bg-bg-light-lm dark:bg-bg-light hover:border-primary-lm dark:hover:border-primary cursor-pointer transition-colors"
                    >
                      <img src={img.url} alt="" className="max-h-full max-w-full object-contain" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Info */}
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-black text-text-lm dark:text-text mb-2 leading-tight">{product.title}</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-text-muted-lm dark:text-text-muted uppercase tracking-widest">{product.vendor}</span>
                    {isVerified && (
                      <span className="flex items-center text-primary-lm dark:text-primary text-[10px] font-bold px-2 py-0.5 bg-primary-lm/10 dark:bg-primary/10 rounded-full uppercase">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Brand Verified
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-bg dark:bg-bg-dark text-text dark:text-white p-6 rounded-2xl">
                  <div className="text-xs text-text-muted-lm dark:text-text-muted mb-1 uppercase font-bold tracking-tighter">Current Price</div>
                  <div className="text-4xl font-black">
                    ${price} <span className="text-sm font-normal text-text-muted-lm dark:text-text-muted">{currency}</span>
                  </div>
                </div>

                {/* Variants Section */}
                {product.options?.map((option: any) => (
                  <div key={option.id}>
                    <span className="block font-bold text-[12px] mb-3 uppercase text-text-muted-lm dark:text-text-muted tracking-widest">{option.name}</span>
                    <div className="flex flex-wrap gap-2">
                      {option.optionValues?.map((val: any) => (
                        <Badge key={val.id} variant="outline" className="px-4 py-2 rounded-lg border-border-lm dark:border-border text-text-lm dark:text-text hover:border-primary-lm dark:hover:border-primary cursor-default">
                          {val.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Description */}
                <div className="pt-6 border-t border-border-lm dark:border-border">
                  <h4 className="font-bold text-text-lm dark:text-text mb-4 uppercase text-xs tracking-widest">Product Overview</h4>
                  <div
                    className="text-text-muted-lm dark:text-text-muted text-sm leading-relaxed prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: product.descriptionHtml || "No detailed description available." }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-border-lm dark:border-border bg-bg-light-lm dark:bg-bg-light sticky bottom-0 flex gap-4">
            <Button variant="outline" className="flex-1 rounded-xl h-14 font-bold border-border-lm dark:border-border hover:bg-bg-lm dark:hover:bg-bg text-text-lm dark:text-text">
              <MessageCircle className="w-5 h-5 mr-2" /> Inquiry
            </Button>
            <Button className="flex-1 rounded-xl h-14 bg-primary-lm dark:bg-primary text-white font-bold hover:bg-primary-lm/90 dark:hover:bg-primary/90 shadow-lg shadow-primary-lm/20 dark:shadow-none">
              View on Store
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
