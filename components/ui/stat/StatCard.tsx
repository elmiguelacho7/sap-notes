import type { ReactNode } from "react";
import Link from "next/link";

const cardBase =
  "rounded-2xl border border-[rgb(var(--rb-surface-border))]/85 bg-[rgb(var(--rb-surface))]/95 px-5 py-4 rb-depth-card transition-[border-color,background-color,box-shadow,transform] duration-200";

const cardInteractive =
  "cursor-pointer rb-depth-hover hover:-translate-y-0.5 hover:border-[rgb(var(--rb-brand-ring))]/38 hover:bg-[rgb(var(--rb-surface-2))]/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--rb-shell-bg))]";

/**
 * Stat card for KPIs. Design system v1 — dark.
 * Optional icon, optional href for clickable navigation tiles.
 */
export function StatCard({
  label,
  value,
  trend,
  icon,
  href,
  className = "",
}: {
  label: string;
  value: ReactNode;
  trend?: ReactNode;
  icon?: ReactNode;
  /** When set, the whole card becomes a link with hover/focus styles. */
  href?: string;
  className?: string;
}) {
  const content = (
    <>
      <div className="flex items-center gap-2.5">
        {icon != null ? <span className="text-[rgb(var(--rb-brand-primary-hover))]/85">{icon}</span> : null}
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[rgb(var(--rb-text-secondary))]">{label}</p>
      </div>
      <div className="mt-3 text-[1.65rem] leading-none font-bold text-[rgb(var(--rb-text-primary))] tracking-[-0.03em] tabular-nums">{value}</div>
      {trend != null ? <div className="mt-1.5 text-xs text-[rgb(var(--rb-text-secondary))]">{trend}</div> : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`block ${cardBase} ${cardInteractive} ${className}`}
        aria-label={`${label}: ${typeof value === "string" || typeof value === "number" ? value : "ver más"}`}
      >
        {content}
      </Link>
    );
  }

  return <div className={`${cardBase} ${className}`}>{content}</div>;
}
