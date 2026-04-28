import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Star,
  MapPin,
  Factory,
  Users,
  Clock,
  TrendingUp,
  ExternalLink,
  Award,
  CheckCircle2,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";
import { toast } from "sonner";
import { removeSavedItem, upsertSavedItem } from "@/lib/saved-items";
import { useSavedItems } from "@/hooks/useSavedItems";

interface AlibabaSupplier {
  name: string;
  country: string;
  yearsAsGoldSupplier: number;
  companyIconUrl: string;
  profileUrl: string;
  totalEmployees: string | null;
  factorySize: string | null;
  annualRevenue: string | null;
  responseRate: string;
  isAssessedSupplier: boolean;
  isVerifiedSupplierPro: boolean;
  productsOffered: string;
  reviewCount: number;
  reviewScore: string;
  serviceTags: string[];
}

export const parseAlibabaSuppliers = (rawResponse: any): any[] | string => {
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
    if (rawResponse.content) return parseAlibabaSuppliers(rawResponse.content);
    return Array.isArray(rawResponse) ? rawResponse : [];
  }

  try {
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return jsonString.includes("[") ? rawResponse : [];
  }
};

export function AlibabaSupplierResponse({ suppliers }: { suppliers: AlibabaSupplier[] }) {
  const { savedIds } = useSavedItems();
  if (!Array.isArray(suppliers) || suppliers.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 font-generalSans text-text-lm dark:text-text" onClick={(e) => e.stopPropagation()}>
      {suppliers.map((supplier, i) => {
        const itemId = `alibaba-supplier:${supplier.profileUrl || `${supplier.name}-${i}`}`;
        const isSaved = savedIds.has(itemId);

        return (
        <Sheet key={supplier.name + i}>
          <SheetTrigger asChild>
            <div className="group cursor-pointer bg-bg-light-lm dark:bg-bg-light border border-border-lm dark:border-border rounded-xl p-5 hover:shadow-lg hover:border-primary-lm dark:hover:border-primary transition-all duration-300">
              <div className="flex gap-4">
                {/* Company Icon */}
                <div className="w-16 h-16 shrink-0 rounded-lg border border-border-lm dark:border-border bg-bg-lm dark:bg-bg overflow-hidden flex items-center justify-center p-2">
                  <img src={supplier.companyIconUrl} alt="" className="max-w-full max-h-full object-contain" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200 text-[10px] font-bold">
                      {supplier.yearsAsGoldSupplier} YRS
                    </Badge>
                    <div className="flex items-center text-[11px] text-zinc-500">
                      <MapPin className="w-3 h-3 mr-1" /> {supplier.country}
                    </div>
                  </div>

                  <h3 className="font-bold text-text-lm dark:text-text truncate group-hover:text-primary-lm dark:group-hover:text-primary transition-colors">{supplier.name}</h3>

                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center text-zinc-700 dark:text-zinc-300 text-xs font-bold">
                      <Star className="w-3 h-3 text-orange-400 fill-current mr-1" />
                      {supplier.reviewScore}
                    </div>
                    <span className="text-[11px] text-zinc-400">{supplier.reviewCount} Reviews</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-100 grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center text-zinc-500">
                  <Clock className="w-3 h-3 mr-1.5" /> Resp: {supplier.responseRate}
                </div>
                <div className="flex items-center text-zinc-500">
                  <TrendingUp className="w-3 h-3 mr-1.5" /> Rev: {supplier.annualRevenue || "N/A"}
                </div>
              </div>
            </div>
          </SheetTrigger>

          <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col bg-bg-lm dark:bg-bg border-l border-border-lm dark:border-border font-generalSans">
            <SheetHeader className="px-6 py-4 bg-bg-light-lm dark:bg-bg-light border-b border-border-lm dark:border-border sticky top-0 z-10">
              <SheetTitle className="flex items-center gap-2 text-orange-600 text-sm font-black uppercase tracking-tighter">
                <ShieldCheck className="w-4 h-4" /> Supplier Profile
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto">
              {/* Hero Branding */}
              <div className="bg-bg-light-lm dark:bg-bg-light p-8 border-b border-border-lm dark:border-border">
                <div className="flex items-start gap-6">
                  <div className="w-24 h-24 rounded-2xl border-2 border-border-lm dark:border-border p-3 bg-bg-light-lm dark:bg-bg-light shadow-sm">
                    <img src={supplier.companyIconUrl} alt="" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-black text-text-lm dark:text-text leading-tight mb-2">{supplier.name}</h2>
                    <div className="flex flex-wrap gap-2">
                      {supplier.isAssessedSupplier && (
                        <Badge className="bg-blue-600 text-white border-none font-bold text-[10px]">VERIFIED SUPPLIER</Badge>
                      )}
                      <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 font-bold text-[10px]">
                        <Award className="w-3 h-3 mr-1" /> {supplier.yearsAsGoldSupplier} YEAR GOLD MEMBER
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-8">
                {/* Core Capabilities */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-bg-light-lm dark:bg-bg-light p-4 rounded-xl border border-border-lm dark:border-border text-center">
                    <Factory className="w-5 h-5 mx-auto mb-2 text-zinc-400" />
                    <div className="text-[10px] font-bold text-zinc-400 uppercase">Factory Size</div>
                    <div className="text-sm font-bold text-text-lm dark:text-text">{supplier.factorySize || "Proprietary"}</div>
                  </div>
                  <div className="bg-bg-light-lm dark:bg-bg-light p-4 rounded-xl border border-border-lm dark:border-border text-center">
                    <Users className="w-5 h-5 mx-auto mb-2 text-zinc-400" />
                    <div className="text-[10px] font-bold text-zinc-400 uppercase">Total Staff</div>
                    <div className="text-sm font-bold text-text-lm dark:text-text">{supplier.totalEmployees || "N/A"}</div>
                  </div>
                  <div className="bg-bg-light-lm dark:bg-bg-light p-4 rounded-xl border border-border-lm dark:border-border text-center">
                    <TrendingUp className="w-5 h-5 mx-auto mb-2 text-zinc-400" />
                    <div className="text-[10px] font-bold text-zinc-400 uppercase">Annual Revenue</div>
                    <div className="text-sm font-bold text-text-lm dark:text-text">{supplier.annualRevenue || "Private"}</div>
                  </div>
                </div>

                {/* Products Offered */}
                <div className="bg-bg-light-lm dark:bg-bg-light p-6 rounded-2xl border border-border-lm dark:border-border">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Main Product Categories</h4>
                  <p className="text-zinc-700 leading-relaxed font-medium">{supplier.productsOffered}</p>
                </div>

                {/* Service Capabilities */}
                {supplier.serviceTags.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Services & Support</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {supplier.serviceTags.map((tag) => (
                        <div key={tag} className="flex items-center gap-2 text-xs font-semibold text-text-muted-lm dark:text-text-muted bg-bg-light-lm dark:bg-bg-light p-3 rounded-lg border border-border-lm dark:border-border">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> {tag}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Action */}
            <div className="p-4 border-t border-border-lm dark:border-border bg-bg-light-lm dark:bg-bg-light flex gap-4">
              <Button
                variant="outline"
                className="h-12 rounded-xl border-border-lm dark:border-border text-text-lm dark:text-text font-bold"
                onClick={() => {
                  if (isSaved) {
                    removeSavedItem(itemId);
                    toast.success("Removed from saved list");
                    return;
                  }

                  upsertSavedItem({
                    id: itemId,
                    kind: "supplier",
                    title: supplier.name,
                    subtitle: `${supplier.country} • ${supplier.reviewScore} stars`,
                    url: supplier.profileUrl,
                    imageUrl: supplier.companyIconUrl,
                    source: "Alibaba",
                    note: supplier.productsOffered,
                  });
                  toast.success("Saved to list");
                }}
              >
                {isSaved ? <BookmarkCheck className="w-4 h-4 mr-2" /> : <Bookmark className="w-4 h-4 mr-2" />}
                {isSaved ? "Saved" : "Save"}
              </Button>
              <Button variant="outline" className="flex-1 h-12 rounded-xl border-border-lm dark:border-border text-text-lm dark:text-text font-bold" onClick={() => window.open(supplier.profileUrl, "_blank")}>
                View Profile
              </Button>
              <Button className="flex-1 h-12 rounded-xl bg-primary-lm dark:bg-primary text-white font-bold hover:bg-primary-lm/90 dark:hover:bg-primary/90 shadow-lg shadow-primary-lm/20 dark:shadow-none">
                Contact Supplier <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )})}
    </div>
  );
}
