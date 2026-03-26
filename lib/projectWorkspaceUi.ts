/**
 * Shared visual grammar for /projects/[id]/* pages (premium light Ribbit workspace).
 * Use these tokens so module pages stay consistent with overview & planning.
 */

/**
 * Inner page stack for /projects/[id] routes.
 * NOTE: max-width + horizontal padding are applied by the shared project layout.
 */
export const PROJECT_WORKSPACE_PAGE = "w-full min-w-0 space-y-6";

/** Reusable section rhythm for titled blocks inside project pages. */
export const PROJECT_WORKSPACE_SECTION_STACK = "space-y-3";

/** Standard surface cards used across project modules. */
export const PROJECT_WORKSPACE_CARD =
  "rounded-2xl border border-slate-200/85 bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100";

export const PROJECT_WORKSPACE_CARD_COMPACT =
  "rounded-2xl border border-slate-200/85 bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100";

export const PROJECT_WORKSPACE_CARD_FRAME =
  "rounded-2xl border border-slate-200/85 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100";

/** Hero / title block at top of a project module page */
export const PROJECT_WORKSPACE_HERO =
  "rounded-2xl border border-slate-200/85 bg-gradient-to-br from-white via-slate-50/55 to-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-12px_rgba(15,23,42,0.08)] ring-1 ring-slate-100";

/** Wrap filter pills + search */
export const PROJECT_WORKSPACE_TOOLBAR =
  "rounded-2xl border border-slate-200/85 bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100";

/** Primary search input (h-10 rhythm) */
export const PROJECT_WORKSPACE_SEARCH_INPUT =
  "w-full min-h-10 rounded-xl border border-slate-200/90 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus-visible:border-[rgb(var(--rb-brand-primary))]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/28";

/** Native select / compact fields in toolbars */
export const PROJECT_WORKSPACE_FIELD =
  "min-h-10 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/25 focus:border-[rgb(var(--rb-brand-primary))]/30";

export const PROJECT_WORKSPACE_FILTER_PILL =
  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white border-slate-200/90 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50";

export const PROJECT_WORKSPACE_FILTER_PILL_ACTIVE =
  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white border-[rgb(var(--rb-brand-primary))]/35 bg-[rgb(var(--rb-brand-primary))]/12 text-[rgb(var(--rb-text-primary))]";

/** Main list/table panel */
export const PROJECT_WORKSPACE_PANEL =
  "w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200/85 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100";

export const PROJECT_WORKSPACE_PANEL_HEADER =
  "border-b border-slate-200/90 bg-slate-50/80 px-5 py-4 sm:px-6";

export const PROJECT_WORKSPACE_TABLE_HEAD_ROW =
  "border-b border-slate-200/90 bg-slate-50/90";

export const PROJECT_WORKSPACE_TABLE_HEAD_CELL =
  "px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500";

export const PROJECT_WORKSPACE_TABLE_BODY =
  "divide-y divide-slate-100 bg-white";

export const PROJECT_WORKSPACE_TABLE_ROW =
  "transition-colors hover:bg-slate-50/90 cursor-pointer";

export const PROJECT_WORKSPACE_EMPTY =
  "flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200/90 bg-slate-50/40 px-6 py-14 text-center";

export const PROJECT_WORKSPACE_BANNER_INFO =
  "rounded-xl border border-slate-200/90 bg-slate-50/90 px-3 py-2 text-xs font-medium text-slate-600";
