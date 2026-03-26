"use client";

/**
 * Sapito assistant avatar: uses the registry (size-specific and thinking state).
 * Single source of truth: lib/agents/agentRegistry.ts.
 * When styledContainer is true, wraps in a premium emerald-tinted ring for Project Copilot.
 * When showOnlineIndicator is true, shows a small emerald dot (e.g. in chat header).
 */
import { SapitoAvatar as UiSapitoAvatar } from "@/components/ui/SapitoAvatar";

export function SapitoAvatar({
  className = "",
  size = "md",
  thinking = false,
  styledContainer = false,
  showOnlineIndicator = false,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  thinking?: boolean;
  /** When true, wraps avatar in rounded-full bg-emerald-500/15 border border-emerald-500/40 container (w-10 h-10 for md) */
  styledContainer?: boolean;
  /** When true, shows online indicator dot (only meaningful with styledContainer) */
  showOnlineIndicator?: boolean;
}) {
  const sizePx = { sm: 28, md: 32, lg: 40 };
  const px = sizePx[size];

  const img = <UiSapitoAvatar size={px} animated={thinking} className={className} />;

  if (styledContainer) {
    const containerPx = size === "sm" ? 36 : size === "md" ? 40 : 48;
    const inner = (
      <div
        className="shrink-0 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center"
        style={{
          width: containerPx,
          height: containerPx,
          minWidth: containerPx,
          minHeight: containerPx,
        }}
        aria-hidden
      >
        {img}
      </div>
    );
    if (showOnlineIndicator && !thinking) {
      return (
        <div className={`relative shrink-0 ${className}`}>
          {inner}
          <span
            className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-slate-900 rounded-full"
            aria-hidden
          />
        </div>
      );
    }
    return <div className={`shrink-0 ${className}`}>{inner}</div>;
  }

  return img;
}
