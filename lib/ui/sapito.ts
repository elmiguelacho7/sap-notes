export type SapitoAssetVariant = "default" | "happy" | "error" | "alert";

const SAPITO_BASE = "/agents/sapito";

// Real available sizes in `public/agents/sapito`.
const SAPITO_SIZES = [24, 32, 48, 64, 96, 128, 192, 256] as const;
export type SapitoSizePx = (typeof SAPITO_SIZES)[number];

const nearestSizeCache = new Map<number, SapitoSizePx>();
export function getSapitoNearestSizePx(sizePx: number): SapitoSizePx {
  const raw = Number.isFinite(sizePx) ? sizePx : 32;
  const rounded = Math.max(1, Math.round(raw));
  const cached = nearestSizeCache.get(rounded);
  if (cached != null) return cached;

  if ((SAPITO_SIZES as readonly number[]).includes(rounded)) {
    const typed = rounded as SapitoSizePx;
    nearestSizeCache.set(rounded, typed);
    return typed;
  }

  // Pick the closest size; if tied, prefer the larger one (better quality).
  let best: SapitoSizePx = SAPITO_SIZES[0];
  let bestDiff = Math.abs(best - rounded);
  for (const s of SAPITO_SIZES) {
    const diff = Math.abs(s - rounded);
    if (diff < bestDiff || (diff === bestDiff && s > best)) {
      best = s;
      bestDiff = diff;
    }
  }

  nearestSizeCache.set(rounded, best);
  return best;
}

function sizedVariant(prefix: string): Record<SapitoSizePx, string> {
  return Object.fromEntries(
    SAPITO_SIZES.map((s) => [s, `${SAPITO_BASE}/${prefix}_${s}x${s}.svg`])
  ) as Record<SapitoSizePx, string>;
}

export const SAPITO_ASSETS = {
  // "default" is the idle/sleeping visual.
  default: sizedVariant("sapito_sleeping"),
  happy: sizedVariant("sapito_happy"),
  error: sizedVariant("sapito_error"),
  alert: sizedVariant("sapito_alert"),

  // Additional variants (not part of the required public helpers, but useful internally).
  thinking: sizedVariant("sapito_thinking"),

  animated: {
    base: `${SAPITO_BASE}/sapito_animated.svg`,
    // Size-specific animated assets exist too.
    ...Object.fromEntries(SAPITO_SIZES.map((s) => [s, `${SAPITO_BASE}/sapito_animated_${s}x${s}.svg`])) ,
  } as Record<"base", string> & Partial<Record<SapitoSizePx, string>>,

  master: {
    base: `${SAPITO_BASE}/sapito_master.svg`,
  },
} as const;

type SizedAssetMap = Record<SapitoSizePx, string>;

function getFromSizedMap(map: SizedAssetMap, sizePx: number): string {
  const nearest = getSapitoNearestSizePx(sizePx);
  return map[nearest] ?? map[SAPITO_SIZES[0]];
}

export function getSapitoAsset(variant: SapitoAssetVariant, sizePx: number): string {
  const map: SizedAssetMap =
    variant === "default"
      ? SAPITO_ASSETS.default
      : variant === "happy"
        ? SAPITO_ASSETS.happy
        : variant === "error"
          ? SAPITO_ASSETS.error
          : SAPITO_ASSETS.alert;

  return getFromSizedMap(map, sizePx);
}

export function getSapitoDefault(sizePx: number): string {
  return getSapitoAsset("default", sizePx);
}

export function getSapitoHappy(sizePx: number): string {
  return getSapitoAsset("happy", sizePx);
}

export function getSapitoError(sizePx: number): string {
  return getSapitoAsset("error", sizePx);
}

export function getSapitoAlert(sizePx: number): string {
  return getSapitoAsset("alert", sizePx);
}

export function getSapitoThinking(sizePx: number): string {
  return getFromSizedMap(SAPITO_ASSETS.thinking as SizedAssetMap, sizePx);
}

export function getSapitoAnimated(sizePx: number): string {
  const nearest = getSapitoNearestSizePx(sizePx);
  const maybeSized = (SAPITO_ASSETS.animated as Record<SapitoSizePx, string | undefined>)[nearest];
  return maybeSized ?? SAPITO_ASSETS.animated.base;
}

export function getSapitoMaster(): string {
  return SAPITO_ASSETS.master.base;
}

