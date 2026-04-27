'use client';

import { useCallback, useEffect, useState } from "react";
import { readSavedItems, SAVED_ITEMS_UPDATED_EVENT, type SavedItem } from "@/lib/saved-items";

export function useSavedItems() {
  const [items, setItems] = useState<SavedItem[]>([]);

  const refresh = useCallback(() => {
    setItems(readSavedItems());
  }, []);

  useEffect(() => {
    refresh();

    window.addEventListener(SAVED_ITEMS_UPDATED_EVENT, refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener(SAVED_ITEMS_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  return {
    items,
    savedIds: new Set(items.map((item) => item.id)),
    refresh,
  };
}
