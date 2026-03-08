"use client";

/**
 * SAP-themed assistant avatar: green circle with "S" for Sapito.
 * Used in chat bubbles, headers, and floating button.
 */
export function SapitoAvatar({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "h-6 w-6 text-xs",
    md: "h-8 w-8 text-sm",
    lg: "h-10 w-10 text-base",
  };
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white font-semibold ${sizeClasses[size]} ${className}`}
      aria-hidden
    >
      S
    </div>
  );
}
