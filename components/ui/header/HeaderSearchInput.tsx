"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

/**
 * Dark-theme search input for header. Submits to knowledge search.
 */
export function HeaderSearchInput({
  placeholder = "Search...",
  className = "",
}: {
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <form
      className={`relative ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        const q = new FormData(e.currentTarget).get("q");
        if (typeof q === "string" && q.trim()) {
          router.push(`/knowledge/search?q=${encodeURIComponent(q.trim())}`);
        }
      }}
    >
      <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-500" />
      <input
        type="search"
        name="q"
        placeholder={placeholder}
        className="h-9 w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        aria-label="Search"
      />
    </form>
  );
}
