"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, FolderKanban, CheckSquare, FileText, Ticket, BookOpen } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export type QuickActionItem = {
  label: string;
  href: string;
  icon?: ReactNode;
};

const ALL_ITEMS: QuickActionItem[] = [
  { label: "Create Project", href: "/projects/new", icon: <FolderKanban className="h-[18px] w-[18px]" /> },
  { label: "Create Task", href: "/tasks", icon: <CheckSquare className="h-[18px] w-[18px]" /> },
  { label: "Create Note", href: "/notes/new", icon: <FileText className="h-[18px] w-[18px]" /> },
  { label: "Create Ticket", href: "/tickets/new", icon: <Ticket className="h-[18px] w-[18px]" /> },
  { label: "Create Knowledge Page", href: "/knowledge", icon: <BookOpen className="h-[18px] w-[18px]" /> },
];

export function QuickActionMenu({
  label = "New",
  items: itemsProp,
  className = "",
}: {
  label?: string;
  items?: QuickActionItem[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [canCreateProject, setCanCreateProject] = useState(false);
  const [itemsReady, setItemsReady] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setCanCreateProject(false);
        setItemsReady(true);
        return;
      }
      const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      if (cancelled) return;
      const data = await res.json().catch(() => ({}));
      const perms = (data as { permissions?: { createProject?: boolean } }).permissions;
      setCanCreateProject(perms?.createProject ?? false);
      setItemsReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const defaultItems =
    itemsReady
      ? canCreateProject
        ? ALL_ITEMS
        : ALL_ITEMS.filter((i) => i.href !== "/projects/new")
      : ALL_ITEMS;
  const items = itemsProp ?? defaultItems;

  // When opening, focus first menu item after DOM update
  useEffect(() => {
    if (!open || items.length === 0) return;
    const id = requestAnimationFrame(() => {
      itemRefs.current[0]?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      const el = document.activeElement;
      const idx = itemRefs.current.indexOf(el as HTMLAnchorElement);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = itemRefs.current[idx + 1] ?? itemRefs.current[0];
        next?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = itemRefs.current[idx - 1] ?? itemRefs.current[itemRefs.current.length - 1];
        prev?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const closeAndFocusTrigger = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-100 hover:bg-slate-700 hover:border-slate-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-2 focus:ring-offset-slate-950"
      >
        <Plus className="h-4 w-4 shrink-0" />
        <span className="hidden md:inline">{label}</span>
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 min-w-[220px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-lg"
          role="menu"
        >
          <div className="p-1">
            {items.map((item, i) => (
              <Link
                key={item.href}
                ref={(node) => { itemRefs.current[i] = node; }}
                href={item.href}
                role="menuitem"
                onClick={() => closeAndFocusTrigger()}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-0"
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
