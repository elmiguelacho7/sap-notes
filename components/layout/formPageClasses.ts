import {
  LAYOUT_WIDTH_DENSE_CLASS,
  LAYOUT_WIDTH_STANDARD_CLASS,
} from "@/lib/layoutSystem";

export const FORM_PAGE_SHELL_CLASS =
  `w-full ${LAYOUT_WIDTH_STANDARD_CLASS} space-y-6 px-6 py-6 lg:px-8`;

export const FORM_PAGE_BLOCK_CLASS = `w-full ${LAYOUT_WIDTH_DENSE_CLASS}`;

export const FORM_PAGE_TITLE_BLOCK_CLASS = `${FORM_PAGE_BLOCK_CLASS} space-y-2`;

export const FORM_PAGE_TITLE_CLASS =
  "text-xl font-semibold text-[rgb(var(--rb-text-primary))]";

export const FORM_PAGE_SUBTITLE_CLASS =
  "max-w-3xl text-sm text-[rgb(var(--rb-text-muted))]";

export const FORM_SECTION_BLOCK_CLASS = "space-y-4";

export const FORM_SECTION_TITLE_CLASS =
  "text-xs font-semibold uppercase tracking-wide text-[rgb(var(--rb-text-muted))]";

export const FORM_SECTION_HELPER_CLASS =
  "text-xs text-[rgb(var(--rb-text-secondary))]";

export const FORM_SECTION_DIVIDER_CLASS =
  "border-t border-[rgb(var(--rb-surface-border))]/50 pt-6";

export const FORM_FOOTER_ACTIONS_CLASS =
  "flex items-center justify-end gap-3 border-t border-[rgb(var(--rb-surface-border))]/50 pt-6";

