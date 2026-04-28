'use client';

import { useMemo, useState } from "react";
import { Bookmark, ExternalLink, Package, Plus, Trash2, Truck, Building2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { clearSavedItems, removeSavedItem, upsertSavedItem, type SavedItemKind } from "@/lib/saved-items";
import { useSavedItems } from "@/hooks/useSavedItems";

function getKindIcon(kind: SavedItemKind) {
  if (kind === "product") return <Package className="w-3.5 h-3.5" />;
  if (kind === "supplier") return <Building2 className="w-3.5 h-3.5" />;
  return <Bookmark className="w-3.5 h-3.5" />;
}

export function SavedItemsSheet() {
  const { items } = useSavedItems();
  const [kind, setKind] = useState<SavedItemKind>("bookmark");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");

  const counts = useMemo(() => {
    return {
      product: items.filter((item) => item.kind === "product").length,
      supplier: items.filter((item) => item.kind === "supplier").length,
      bookmark: items.filter((item) => item.kind === "bookmark").length,
    };
  }, [items]);

  const handleAdd = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Title is required");
      return;
    }

    const id = `manual:${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()}`;

    upsertSavedItem({
      id,
      kind,
      title: trimmedTitle,
      note: note.trim() || undefined,
      url: url.trim() || undefined,
      source: "Manual",
    });

    setTitle("");
    setUrl("");
    setNote("");
    setKind("bookmark");
    toast.success("Added to saved list");
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-center w-8 h-8 text-text-muted-lm dark:text-text-muted hover:text-text-lm dark:hover:text-text transition-colors rounded-full hover:bg-black/5 dark:hover:bg-white/10"
          title="Saved list"
        >
          <Bookmark className="w-5 h-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b border-border-lm dark:border-border">
          <SheetTitle className="text-sm font-bold flex items-center gap-2">
            <Bookmark className="w-4 h-4" /> Saved List
          </SheetTitle>
        </SheetHeader>

        <div className="px-6 py-4 border-b border-border-lm dark:border-border flex flex-wrap gap-2">
          <Badge variant="outline">Products: {counts.product}</Badge>
          <Badge variant="outline">Suppliers: {counts.supplier}</Badge>
          <Badge variant="outline">Bookmarks: {counts.bookmark}</Badge>
        </div>

        <div className="px-6 py-4 border-b border-border-lm dark:border-border space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-text-muted-lm dark:text-text-muted">Add Custom Item</div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as SavedItemKind)}
              className="h-10 rounded-md border border-border-lm dark:border-border bg-transparent px-3 text-sm"
            >
              <option value="bookmark">Bookmark</option>
              <option value="product">Product</option>
              <option value="supplier">Supplier</option>
            </select>
            <Button type="button" onClick={handleAdd} className="h-10">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input placeholder="URL (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Textarea
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-[72px]"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {items.length === 0 ? (
            <div className="text-sm text-text-muted-lm dark:text-text-muted">No saved items yet.</div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="p-3 rounded-xl border border-border-lm dark:border-border bg-bg-light-lm dark:bg-bg-light space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm line-clamp-2">{item.title}</div>
                    {item.subtitle && <div className="text-xs text-text-muted-lm dark:text-text-muted line-clamp-1">{item.subtitle}</div>}
                  </div>
                  <Badge variant="secondary" className="shrink-0 inline-flex items-center gap-1">
                    {getKindIcon(item.kind)} {item.kind}
                  </Badge>
                </div>

                {(item.price || item.source) && (
                  <div className="flex items-center gap-2 text-xs text-text-muted-lm dark:text-text-muted">
                    {item.price && <span>{item.price}</span>}
                    {item.source && (
                      <span className="inline-flex items-center gap-1">
                        <Truck className="w-3 h-3" /> {item.source}
                      </span>
                    )}
                  </div>
                )}

                {item.note && <div className="text-xs text-zinc-500 line-clamp-2">{item.note}</div>}

                <div className="flex items-center gap-2">
                  {item.url && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => window.open(item.url, "_blank")}
                    >
                      Open <ExternalLink className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-red-500 hover:text-red-600"
                    onClick={() => removeSavedItem(item.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-4 border-t border-border-lm dark:border-border">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              clearSavedItems();
              toast.success("Saved list cleared");
            }}
            disabled={items.length === 0}
          >
            Clear All
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
