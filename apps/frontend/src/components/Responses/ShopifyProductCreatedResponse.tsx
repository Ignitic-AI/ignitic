import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ExternalLink, Tag, Globe, Database, Calendar, Sparkles } from "lucide-react";

interface Props {
  product: any;
}

export const parseShopifyCreatedProduct = (rawResponse: any): any | string => {
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
    if (rawResponse.content) return parseShopifyCreatedProduct(rawResponse.content);
    return rawResponse;
  }

  try {
    const parsed = JSON.parse(jsonString);
    // Drill down to the newly created product
    // Note the path: data -> productCreate -> product
    return parsed?.data?.productCreate?.product || null;
  } catch (error) {
    return jsonString.includes("{") ? rawResponse : null;
  }
};

export function ShopifyProductCreatedResponse({ product }: Props) {
  if (!product || typeof product === "string") return null;

  const createdAt = product.createdAt ? new Date(product.createdAt).toLocaleDateString() : "N/A";
  const tags = product.tags || [];
  const metafields = product.metafields?.edges?.map((e: any) => e.node) || [];

  return (
    <div className="mt-4 max-w-lg" onClick={(e) => e.stopPropagation()}>
      <Sheet>
        <SheetTrigger asChild>
          <div className="group cursor-pointer bg-white dark:bg-zinc-950 rounded-2xl border-2 border-emerald-100 dark:border-emerald-900/30 overflow-hidden hover:border-emerald-500 transition-all duration-300">
            <div className="p-1 bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Product Created Successfully</span>
            </div>

            <div className="p-5 flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                <Sparkles className="w-8 h-8 text-zinc-400" />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate mb-1">{product.title}</h3>
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{product.vendor}</span>
                  <span>-</span>
                  <span>{product.status}</span>
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-900 p-2 rounded-lg self-center group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                <ExternalLink className="w-4 h-4" />
              </div>
            </div>
          </div>
        </SheetTrigger>

        <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col bg-white dark:bg-zinc-950">
          <SheetHeader className="px-6 py-4 border-b flex flex-row items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/30">
            <SheetTitle className="text-sm font-bold uppercase tracking-tighter text-zinc-500 dark:text-zinc-400">Creation Details</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="p-8 space-y-8">
              {/* Header Info */}
              <div>
                <Badge className="mb-4 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Active in Catalog
                </Badge>
                <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 leading-tight mb-2">{product.title}</h2>
                <p className="text-zinc-500 dark:text-zinc-400 font-medium">
                  Handle: <span className="text-zinc-900 dark:text-zinc-100">{product.handle}</span>
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2 text-zinc-400 mb-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase">Created On</span>
                  </div>
                  <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{createdAt}</div>
                </div>
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2 text-zinc-400 mb-1">
                    <Tag className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase">Type</span>
                  </div>
                  <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{product.productType || "Standard"}</div>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Description</h4>
                <div
                  className="prose prose-sm text-zinc-600 dark:text-zinc-300 border-l-2 border-zinc-100 dark:border-zinc-800 pl-4"
                  dangerouslySetInnerHTML={{ __html: product.descriptionHtml || "" }}
                />
              </div>

              {/* SEO Section */}
              <div className="p-6 rounded-2xl bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 space-y-3">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-300">
                  <Globe className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-widest">Search Engine Listing</h4>
                </div>
                <div className="space-y-1">
                  <div className="text-blue-800 dark:text-blue-200 font-bold text-sm">{product.seo?.title || "N/A"}</div>
                  <div className="text-zinc-500 dark:text-zinc-400 text-xs line-clamp-2">{product.seo?.description || "N/A"}</div>
                </div>
              </div>

              {/* Metafields */}
              {metafields.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-zinc-400 mb-4">
                    <Database className="w-4 h-4" />
                    <h4 className="text-xs font-bold uppercase tracking-widest">Metafields</h4>
                  </div>
                  <div className="space-y-2">
                    {metafields.map((mf: any) => (
                      <div key={mf.id} className="flex items-center justify-between p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                        <span className="text-xs font-medium text-zinc-500">{mf.key}</span>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {mf.value}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {tags.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag: string) => (
                      <Badge key={tag} className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-md">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t bg-zinc-50 dark:bg-zinc-900 sticky bottom-0">
            <Button className="w-full h-12 bg-zinc-900 text-white font-bold rounded-xl hover:bg-zinc-800">
              Edit Product in Shopify
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
