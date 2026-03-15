const RECENT_STORAGE_KEY = "sap-notes-command-palette-recent";
const RECENT_MAX = 8;

export type RecentItem = {
  type: "note" | "ticket";
  id: string;
  title: string;
  href: string;
};

export function getRecentItems(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentItem[];
    return Array.isArray(parsed) ? parsed.slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function addToRecent(item: RecentItem): void {
  if (typeof window === "undefined") return;
  try {
    const list = getRecentItems().filter(
      (r) => !(r.type === item.type && r.id === item.id)
    );
    list.unshift(item);
    window.localStorage.setItem(
      RECENT_STORAGE_KEY,
      JSON.stringify(list.slice(0, RECENT_MAX))
    );
  } catch {
    // ignore
  }
}
