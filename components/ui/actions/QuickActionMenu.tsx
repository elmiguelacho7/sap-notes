"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus, FolderKanban, CheckSquare, FileText, Ticket, BookOpen } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export type QuickActionItem = {
  label: string;
  href: string;
  icon?: ReactNode;
};

export function QuickActionMenu({
  items: itemsProp,
  className = "",
}: {
  items?: QuickActionItem[];
  className?: string;
}) {
  const t = useTranslations("common.quickActions");
  const [open, setOpen] = useState(false);
  const [canCreateProject, setCanCreateProject] = useState(false);
  const [itemsReady, setItemsReady] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const defaultItems = useMemo<QuickActionItem[]>(
    () => [
      {
        label: t("createProject"),
        href: "/projects/new",
        icon: <FolderKanban className="h-[18px] w-[18px]" />,
      },
      {
        label: t("createTask"),
        href: "/tasks",
        icon: <CheckSquare className="h-[18px] w-[18px]" />,
      },
      {
        label: t("createNote"),
        href: "/notes/new",
        icon: <FileText className="h-[18px] w-[18px]" />,
      },
      {
        label: t("createTicket"),
        href: "/tickets/new",
        icon: <Ticket className="h-[18px] w-[18px]" />,
      },
      {
        label: t("createKnowledgePage"),
        href: "/knowledge",
        icon: <BookOpen className="h-[18px] w-[18px]" />,
      },
    ],
    [t]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
    return () => {
      cancelled = true;
    };
  }, []);

  const resolvedDefaultItems =
    itemsReady
      ? canCreateProject
        ? defaultItems
        : defaultItems.filter((i) => i.href !== "/projects/new")
      : defaultItems;
  const items = itemsProp ?? resolvedDefaultItems;

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
        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-transparent bg-[rgb(var(--rb-brand-primary))] px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-[rgb(var(--rb-brand-primary-hover))] active:bg-[rgb(var(--rb-brand-primary-active))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--rb-shell-bg))]"
      >
        <Plus className="h-4 w-4 shrink-0" />
        <span className="hidden md:inline">{t("trigger")}</span>
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 min-w-[220px] overflow-hidden rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 backdrop-blur-sm shadow-md"
          role="menu"
        >
          <div className="p-1">
            {items.map((item, i) => (
              <Link
                key={item.href}
                ref={(node) => {
                  itemRefs.current[i] = node;
                }}
                href={item.href}
                role="menuitem"
                onClick={() => closeAndFocusTrigger()}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] transition-all duration-150 hover:bg-[rgb(var(--rb-surface))]/80 hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-inset ${
                  i === 0 ? "font-medium bg-[rgb(var(--rb-brand-primary))]/5" : ""
                }`}
              >
                {item.icon ? (
                  <span className="shrink-0 text-[rgb(var(--rb-brand-primary))] [&_svg]:block">{item.icon}</span>
                ) : null}
                <span className="truncate">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
