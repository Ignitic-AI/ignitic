export type SavedItemKind = "product" | "supplier" | "bookmark";

export interface SavedItem {
  id: string;
  kind: SavedItemKind;
  title: string;
  subtitle?: string;
  price?: string;
  url?: string;
  imageUrl?: string;
  source?: string;
  note?: string;
  createdAt: string;
}

export const SAVED_ITEMS_STORAGE_KEY = "chat.saved-items.v1";
export const SAVED_ITEMS_UPDATED_EVENT = "saved-items-updated";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function emitSavedItemsUpdated() {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(SAVED_ITEMS_UPDATED_EVENT));
}

export function readSavedItems(): SavedItem[] {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(SAVED_ITEMS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item.id === "string" && typeof item.title === "string")
      .sort((a, b) => +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0));
  } catch {
    return [];
  }
}

export function writeSavedItems(items: SavedItem[]): void {
  if (!isBrowser()) return;

  window.localStorage.setItem(SAVED_ITEMS_STORAGE_KEY, JSON.stringify(items));
  emitSavedItemsUpdated();
}

export function upsertSavedItem(item: Omit<SavedItem, "createdAt"> & { createdAt?: string }): SavedItem[] {
  const all = readSavedItems();
  const normalized: SavedItem = {
    ...item,
    createdAt: item.createdAt || new Date().toISOString(),
  };

  const withoutCurrent = all.filter((entry) => entry.id !== normalized.id);
  const next = [normalized, ...withoutCurrent];
  writeSavedItems(next);
  return next;
}

export function removeSavedItem(id: string): SavedItem[] {
  const next = readSavedItems().filter((item) => item.id !== id);
  writeSavedItems(next);
  return next;
}

export function clearSavedItems(): void {
  writeSavedItems([]);
}

export function isSavedItem(id: string): boolean {
  return readSavedItems().some((item) => item.id === id);
}
