"use client";

import Image from "next/image";

const VARIANT_IMAGE: Record<
  "empty" | "loading" | "error" | "success" | "thinking" | "alert",
  string
> = {
  empty: "sapito_sleeping",
  loading: "sapito_thinking",
  error: "sapito_error",
  success: "sapito_happy",
  thinking: "sapito_thinking",
  alert: "sapito_alert",
};

const SIZE_PX = { sm: 64, md: 128, lg: 256 } as const;

export type SapitoStateVariant =
  | "empty"
  | "loading"
  | "error"
  | "success"
  | "thinking"
  | "alert";

export interface SapitoStateProps {
  variant: SapitoStateVariant;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  /** Optional cache-busting query (e.g. "v=1") */
  imageQuery?: string;
  /** "light" for light backgrounds (e.g. white cards), "dark" for dark pages */
  tone?: "light" | "dark";
}

const TONE_CLASS = {
  light: { title: "text-slate-700", desc: "text-slate-500" },
  dark: { title: "text-slate-200", desc: "text-slate-500" },
} as const;

export function SapitoState({
  variant,
  title,
  description,
  size = "md",
  imageQuery,
  tone = "dark",
}: SapitoStateProps) {
  const base = VARIANT_IMAGE[variant];
  const px = SIZE_PX[size];
  const filename = `${base}_${px}x${px}.svg`;
  const src = `/agents/sapito/${filename}${imageQuery ? `?${imageQuery}` : ""}`;
  const text = TONE_CLASS[tone];

  return (
    <div className="flex flex-col items-center justify-center text-center gap-4 py-8 px-4">
      <Image
        src={src}
        alt=""
        width={px}
        height={px}
        className="shrink-0"
        unoptimized
      />
      <div className="space-y-1">
        <p className={`text-sm font-medium ${text.title}`}>{title}</p>
        {description && (
          <p className={`text-sm max-w-md ${text.desc}`}>{description}</p>
        )}
      </div>
    </div>
  );
}
