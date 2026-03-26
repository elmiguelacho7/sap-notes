"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

/**
 * Dark-theme search input for header. Submits to global search (projects, tasks, tickets, notes, knowledge, clients).
 */
export function HeaderSearchInput({ className = "" }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const params = useParams<{ id?: string }>();
  const t = useTranslations("common.search");

  const projectIdFromPath = (() => {
    const match = pathname.match(/^\/projects\/([^/]+)/);
    if (match?.[1] && match[1] !== "new") return match[1];
    const p = params?.id;
    if (typeof p === "string" && p.trim() && p !== "new") return p;
    return null;
  })();

  return (
    <form
      className={`relative ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        const q = new FormData(e.currentTarget).get("q");
        if (typeof q === "string" && q.trim()) {
          const encoded = encodeURIComponent(q.trim());
          router.push(projectIdFromPath ? `/projects/${projectIdFromPath}/search?q=${encoded}` : `/search?q=${encoded}`);
        }
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[rgb(var(--rb-text-muted))]" aria-hidden />
      <input
        type="search"
        name="q"
        placeholder={t("headerInputPlaceholder")}
        className="h-9 w-full max-w-sm rounded-[10px] border border-[rgb(var(--rb-surface-border))]/90 bg-[rgb(var(--rb-surface-2))]/95 pl-9 pr-3 text-sm text-[rgb(var(--rb-text-primary))] placeholder:text-[rgb(var(--rb-text-muted))] placeholder:font-normal outline-none transition-[border-color,background-color,box-shadow] duration-200 hover:border-[rgb(var(--rb-brand-primary))]/25 hover:bg-[rgb(var(--rb-surface))]/98 focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/45"
        aria-label={t("headerInputAria")}
      />
    </form>
  );
}
