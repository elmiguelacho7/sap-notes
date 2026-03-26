"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type TabsNavItem = {
  label: string;
  href: string;
  exact?: boolean;
  icon?: React.ReactNode;
};

export function TabsNav({
  items,
  className = "",
  variant = "light",
}: {
  items: TabsNavItem[];
  className?: string;
  variant?: "light" | "dark";
}) {
  const pathname = usePathname();

  const wrapperClass =
    variant === "dark"
      ? "flex items-center gap-0.5 rounded-lg bg-[rgb(var(--rb-surface-2))]/85 border border-[rgb(var(--rb-surface-border))]/85 p-1 overflow-x-auto overflow-y-hidden min-w-0"
      : "flex items-center gap-1 rounded-2xl border border-[rgb(var(--rb-surface-border))]/90 bg-[rgb(var(--rb-surface))]/98 p-1 overflow-x-auto overflow-y-hidden min-w-0";

  return (
    <div className={`${wrapperClass} ${className}`.trim()}>
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname?.startsWith(`${item.href}/`);

        const linkClass =
          variant === "dark"
            ? active
              ? "bg-[rgb(var(--rb-brand-primary))]/12 text-[rgb(var(--rb-brand-primary-hover))] shadow-sm"
              : "text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-brand-primary))]/10 hover:text-[rgb(var(--rb-text-primary))]"
            : active
              ? "bg-[rgb(var(--rb-brand-primary))]/12 text-[rgb(var(--rb-brand-primary-hover))]"
              : "text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-3))]/70";

        const iconClass =
          variant === "dark"
            ? active
              ? "text-[rgb(var(--rb-brand-primary-hover))]"
              : "text-[rgb(var(--rb-text-muted))]"
            : "text-[rgb(var(--rb-text-muted))]";

        const sizeClass = variant === "dark" ? "gap-1.5 rounded-md px-2.5 py-1.5 text-xs" : "gap-2 rounded-lg px-3 py-2 text-sm";
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative inline-flex items-center font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-0 ${sizeClass} ${linkClass}`}
          >
            {item.icon ? <span className={iconClass}>{item.icon}</span> : null}
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
