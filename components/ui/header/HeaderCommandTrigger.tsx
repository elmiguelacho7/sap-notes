"use client";

import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

export const COMMAND_OPEN_EVENT = "open-command-palette";

function openCommandPalette() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(COMMAND_OPEN_EVENT));
  }
}

export function HeaderCommandTrigger() {
  const t = useTranslations("common.search");
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className="w-full max-w-[26rem] h-9 rounded-xl border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface))]/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] pl-3 pr-2.5 flex items-center gap-2.5 text-sm transition-[border-color,background-color,box-shadow] duration-200 hover:border-[rgb(var(--rb-surface-border))]/80 hover:bg-[rgb(var(--rb-surface))]/96 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] focus:outline-none focus-visible:border-[rgb(var(--rb-brand-primary))]/25 focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--rb-shell-bg))]"
      aria-label={t("commandAria")}
    >
      <Search className="h-[17px] w-[17px] shrink-0 text-[rgb(var(--rb-text-muted))]" aria-hidden />
      <span className="flex-1 min-w-0 text-left truncate text-[13px] text-[rgb(var(--rb-text-secondary))] font-normal tracking-tight">
        {t("commandPlaceholder")}
      </span>
      <kbd className="hidden sm:inline-flex h-[22px] items-center rounded-md border border-[rgb(var(--rb-surface-border))]/55 bg-[rgb(var(--rb-surface-3))]/45 px-1.5 text-[10px] font-medium tabular-nums text-[rgb(var(--rb-text-muted))]">
        ⌘K
      </kbd>
    </button>
  );
}

/** Icon-only trigger for mobile right cluster. */
export function HeaderCommandTriggerIcon() {
  const t = useTranslations("common.search");
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className="md:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface))]/92 text-[rgb(var(--rb-text-muted))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-[rgb(var(--rb-surface-border))]/80 hover:bg-[rgb(var(--rb-surface))]/96 hover:text-[rgb(var(--rb-text-secondary))] transition-[border-color,background-color,color] duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--rb-shell-bg))]"
      aria-label={t("iconAria")}
    >
      <Search className="h-4 w-4" aria-hidden />
    </button>
  );
}
