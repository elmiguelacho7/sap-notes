"use client";

/**
 * Minimal "technical frog" avatar for Sapito branding.
 * Works at small sizes (button, panel header); compatible with light and dark UI.
 */
export function SapitoAvatar({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeMap = { sm: 16, md: 20, lg: 24 };
  const s = sizeMap[size];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white ${className}`}
      style={{ width: s, height: s }}
      aria-hidden
    >
      <svg
        width={s * 0.55}
        height={s * 0.55}
        viewBox="0 0 24 24"
        fill="currentColor"
        className="text-white"
      >
        <ellipse cx="12" cy="13" rx="9" ry="7" />
        <circle cx="9" cy="10" r="2" />
        <circle cx="15" cy="10" r="2" />
      </svg>
    </span>
  );
}
