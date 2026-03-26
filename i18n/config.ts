/**
 * Cookie-based locale only — no URL segments, no next-intl routing middleware.
 * Keep in sync with message folders under /messages/{locale}/.
 */
export const LOCALES = ["en", "es"] as const;

export type AppLocale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";

/** Same name next-intl middleware used; kept for the language switcher + request config. */
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

export function isAppLocale(value: string | undefined): value is AppLocale {
  return value === "en" || value === "es";
}
