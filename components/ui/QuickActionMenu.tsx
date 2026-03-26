"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";

export type QuickActionItem = {
  label: string;
  href: string;
  icon?: ReactNode;
};

export function QuickActionMenu({
  label,
  items,
  className = "",
}: {
  label?: string;
  items: QuickActionItem[];
  className?: string;
}) {
  const t = useTranslations("common.quickActions");
  const buttonLabel = label ?? t("trigger");
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
      <Button
        variant="default"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="h-9 rounded-lg px-3 py-1.5 shadow-sm"
      >
        <Plus className="h-4 w-4 shrink-0" />
        {buttonLabel}
      </Button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 min-w-[220px] overflow-hidden rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 backdrop-blur-sm shadow-md"
          role="menu"
        >
          <div className="p-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] transition-all duration-150 hover:bg-[rgb(var(--rb-surface))]/80 hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-inset"
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
