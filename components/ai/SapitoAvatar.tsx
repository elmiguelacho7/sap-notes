"use client";

/**
 * Sapito assistant avatar: uses the registry (size-specific and thinking state).
 * Single source of truth: lib/agents/agentRegistry.ts.
 */
import Image from "next/image";
import { getSapitoAvatarSrc } from "@/lib/agents/agentRegistry";

export function SapitoAvatar({
  className = "",
  size = "md",
  thinking = false,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  thinking?: boolean;
}) {
  const sizePx = { sm: 24, md: 32, lg: 40 };
  const px = sizePx[size];
  const src = getSapitoAvatarSrc(px, thinking);

  return (
    <Image
      src={src}
      alt="Sapito"
      width={px}
      height={px}
      className={`shrink-0 rounded-full object-cover ${className}`}
      style={{ width: px, height: px, minWidth: px, minHeight: px }}
      aria-hidden
    />
  );
}
