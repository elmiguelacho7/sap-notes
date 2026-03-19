"use client";

import { Search } from "lucide-react";

export const COMMAND_OPEN_EVENT = "open-command-palette";

function openCommandPalette() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(COMMAND_OPEN_EVENT));
  }
}

export function HeaderCommandTrigger() {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className="w-full max-w-md h-9 rounded-xl border border-slate-800 bg-slate-900/80 px-3 flex items-center gap-3 text-sm text-slate-400 hover:border-slate-700 hover:text-slate-300 transition-colors duration-150 focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-700"
      aria-label="Search projects, notes, tickets"
    >
      <Search className="h-4 w-4 shrink-0 text-slate-500" />
      <span className="flex-1 text-left truncate">Search projects, notes, tickets...</span>
      <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-slate-600 bg-slate-800/80 px-1.5 text-[10px] font-medium text-slate-500">
        ⌘K
      </kbd>
    </button>
  );
}

/** Icon-only trigger for mobile right cluster. */
export function HeaderCommandTriggerIcon() {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className="md:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:text-slate-300 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-2 focus:ring-offset-slate-950"
      aria-label="Search"
    >
      <Search className="h-4 w-4" />
    </button>
  );
}
