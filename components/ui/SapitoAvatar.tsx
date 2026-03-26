"use client";

import Image from "next/image";
import {
  getSapitoAsset,
  getSapitoDefault,
  getSapitoNearestSizePx,
  getSapitoHappy,
  getSapitoError,
  getSapitoAlert,
  getSapitoThinking,
  type SapitoAssetVariant,
} from "@/lib/ui/sapito";

export type SapitoAvatarProps = {
  size?: number;
  variant?: SapitoAssetVariant;
  /** When true, shows the "thinking" visual (animated assistant state). */
  animated?: boolean;
  className?: string;
};

export function SapitoAvatar({
  size = 32,
  variant = "default",
  animated = false,
  className,
}: SapitoAvatarProps) {
  const px = getSapitoNearestSizePx(size);

  const src = animated
    ? getSapitoThinking(px)
    : variant === "default"
      ? getSapitoDefault(px)
      : variant === "happy"
        ? getSapitoHappy(px)
        : variant === "error"
          ? getSapitoError(px)
          : variant === "alert"
            ? getSapitoAlert(px)
            : getSapitoAsset(variant, px);

  return (
    <Image
      src={src}
      alt="Sapito"
      width={px}
      height={px}
      unoptimized
      className={`shrink-0 rounded-full object-cover ${className ?? ""}`}
      style={{ width: px, height: px, minWidth: px, minHeight: px }}
      aria-hidden
    />
  );
}

