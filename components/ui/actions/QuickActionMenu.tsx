"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, FolderKanban, CheckSquare, FileText, Ticket } from "lucide-react";

export type QuickActionItem = {
  label: string;
  href: string;
  icon?: ReactNode;
};

const DEFAULT_ITEMS: QuickActionItem[] = [
  { label: "Create Project", href: "/projects/new", icon: <FolderKanban className="h-[18px] w-[18px]" /> },
  { label: "Create Task", href: "/tasks", icon: <CheckSquare className="h-[18px] w-[18px]" /> },
  { label: "Create Note", href: "/notes/new", icon: <FileText className="h-[18px] w-[18px]" /> },
  { label: "Create Ticket", href: "/tickets/new", icon: <Ticket className="h-[18px] w-[18px]" /> },
];

export function QuickActionMenu({
  label = "+ Create",
  items = DEFAULT_ITEMS,
  className = "",
}: {
  label?: string;
  items?: QuickActionItem[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open]);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
      >
        <Plus className="h-[18px] w-[18px]" />
        {label}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 min-w-[220px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-lg"
          role="menu"
        >
          <div className="p-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                {item.icon ? <span className="text-slate-500">{item.icon}</span> : null}
                <span className="truncate">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
