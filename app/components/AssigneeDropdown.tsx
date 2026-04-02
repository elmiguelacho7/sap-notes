"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, User } from "lucide-react";

const DROPDOWN_Z_INDEX = 99999;
const GAP_PX = 4;
const PADDING_VIEWPORT = 8;

type Option = { value: string; label: string };

type AssigneeDropdownProps = {
  options: Option[];
  value: string | null;
  onChange: (profileId: string | null) => void;
  disabled?: boolean;
  /** Optional class for the trigger button. */
  className?: string;
  /** Label to show when no assignee (default "Sin asignar"). */
  placeholder?: string;
  /** Visual style: unassigned uses muted slate. */
  variant?: "assigned" | "unassigned";
  /**
   * `light` = Ribbit shell form controls (light surface, brand focus).
   * Default preserves dark styling for Kanban / legacy surfaces.
   */
  appearance?: "default" | "light";
};

/**
 * Assignee selector that renders its dropdown in a portal so it is never
 * clipped by overflow on parent/board columns. Uses position: fixed and
 * viewport clamping so the dropdown stays visible.
 */
export function AssigneeDropdown({
  options,
  value,
  onChange,
  disabled = false,
  className = "",
  placeholder = "Sin asignar",
  variant = "assigned",
  appearance = "default",
}: AssigneeDropdownProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isLight = appearance === "light";

  const selectedLabel = value
    ? options.find((o) => o.value === value)?.label ?? placeholder
    : placeholder;

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const listEl = listRef.current;
    const listHeight = listEl ? Math.min(listEl.offsetHeight, 280) : 200;
    const listWidth = Math.max(rect.width, 160);

    let top = rect.bottom + GAP_PX;
    let left = rect.left;

    if (top + listHeight + PADDING_VIEWPORT > viewportHeight) {
      top = rect.top - listHeight - GAP_PX;
    }
    if (top < PADDING_VIEWPORT) top = PADDING_VIEWPORT;
    if (left + listWidth > viewportWidth - PADDING_VIEWPORT) {
      left = viewportWidth - listWidth - PADDING_VIEWPORT;
    }
    if (left < PADDING_VIEWPORT) left = PADDING_VIEWPORT;

    setPosition({ top, left, width: listWidth });
  }, []);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    updatePosition();
    const raf = requestAnimationFrame(() => updatePosition());
    const raf2 = requestAnimationFrame(() => updatePosition());
    const onScroll = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", updatePosition);
    const t = setTimeout(updatePosition, 50);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(raf2);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        listRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSelect = (profileId: string | null) => {
    onChange(profileId);
    setOpen(false);
  };

  const panelClass = isLight
    ? "fixed rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] py-1 shadow-lg max-h-[280px] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgb(var(--rb-surface-border))_transparent]"
    : "fixed rounded-lg border border-slate-600 bg-slate-800 shadow-xl ring-1 ring-slate-600/50 py-1 max-h-[280px] overflow-y-auto";

  const dropdownContent =
    open && position && typeof document !== "undefined" ? (
      <div
        ref={listRef}
        className={panelClass}
        style={{
          zIndex: DROPDOWN_Z_INDEX,
          top: position.top,
          left: position.left,
          minWidth: position.width,
        }}
        role="listbox"
      >
        <button
          type="button"
          role="option"
          aria-selected={!value}
          onClick={() => handleSelect(null)}
          className={
            isLight
              ? "flex w-full min-w-0 items-center gap-2.5 px-3 py-2 text-left text-xs text-[rgb(var(--rb-text-secondary))] transition-colors hover:bg-[rgb(var(--rb-surface))]/80 hover:text-[rgb(var(--rb-text-primary))]"
              : "flex w-full min-w-0 items-center gap-2.5 px-3 py-2 text-left text-xs text-slate-400 hover:bg-slate-700/80 hover:text-slate-300"
          }
        >
          <span
            className={
              isLight
                ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/40 text-[rgb(var(--rb-text-muted))]"
                : "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700/80 text-slate-500"
            }
            aria-hidden
          >
            <User className="h-3 w-3" />
          </span>
          <span className="min-w-0 truncate" title={placeholder}>
            {placeholder}
          </span>
        </button>
        {options.length === 0 && (
          <p
            className={
              isLight
                ? "border-t border-[rgb(var(--rb-surface-border))]/60 px-3 py-2 text-[11px] text-[rgb(var(--rb-text-muted))]"
                : "border-t border-slate-700/60 px-3 py-2 text-[11px] text-slate-500"
            }
          >
            {isLight ? "No users available" : "No hay usuarios disponibles"}
          </p>
        )}
        {options.map((opt) => {
          const isSelected = value === opt.value;
          const initial = (opt.label.trim() || "?").charAt(0).toUpperCase();
          return (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => handleSelect(opt.value)}
              title={opt.label}
              className={
                isLight
                  ? `flex w-full min-w-0 items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                      isSelected
                        ? "bg-[rgb(var(--rb-brand-primary))]/12 text-[rgb(var(--rb-text-primary))]"
                        : "text-[rgb(var(--rb-text-primary))] hover:bg-[rgb(var(--rb-surface))]/80"
                    }`
                  : `flex w-full min-w-0 items-center gap-2.5 px-3 py-2 text-left text-xs ${
                      isSelected
                        ? "bg-indigo-500/20 text-indigo-200"
                        : "text-slate-300 hover:bg-slate-700/80 hover:text-slate-200"
                    }`
              }
            >
              <span
                className={
                  isLight
                    ? `flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${
                        isSelected
                          ? "border border-[rgb(var(--rb-brand-primary))]/30 bg-[rgb(var(--rb-brand-primary))]/15 text-[rgb(var(--rb-brand-primary))]"
                          : "border border-[rgb(var(--rb-surface-border))]/50 bg-[rgb(var(--rb-surface-3))]/40 text-[rgb(var(--rb-text-muted))]"
                      }`
                    : `flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${
                        isSelected ? "bg-indigo-500/40 text-indigo-200" : "bg-slate-700/80 text-slate-400"
                      }`
                }
                aria-hidden
              >
                {initial}
              </span>
              <span className="min-w-0 truncate">{opt.label}</span>
            </button>
          );
        })}
      </div>
    ) : null;

  const darkTriggerClass =
    variant === "unassigned"
      ? "border-slate-600 bg-slate-800/70 text-slate-500 hover:bg-slate-700/70 hover:text-slate-400"
      : "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700/80";

  const lightTriggerClass =
    variant === "unassigned"
      ? "border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/90 text-[rgb(var(--rb-text-muted))] hover:border-[rgb(var(--rb-surface-border))]/85 hover:bg-[rgb(var(--rb-surface))] hover:text-[rgb(var(--rb-text-secondary))]"
      : "border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 text-[rgb(var(--rb-text-primary))] hover:border-[rgb(var(--rb-surface-border))]/85 hover:bg-[rgb(var(--rb-surface))]";

  const triggerLayout = isLight
    ? `inline-flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border px-2.5 text-xs font-medium ${lightTriggerClass}`
    : `inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${darkTriggerClass}`;

  const avatarClass = isLight
    ? value
      ? variant === "assigned"
        ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[rgb(var(--rb-brand-primary))]/22 bg-[rgb(var(--rb-brand-primary))]/12 text-[10px] font-semibold text-[rgb(var(--rb-brand-primary))]"
        : "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/40 text-[10px] font-semibold text-[rgb(var(--rb-text-muted))]"
      : "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/35 text-[rgb(var(--rb-text-muted))]"
    : value
      ? variant === "assigned"
        ? "flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-600 text-[10px] font-medium leading-none text-slate-200"
        : "flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-700/80 text-[10px] font-medium leading-none text-slate-500"
      : "flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-700/80 text-slate-500";

  const chevronClass = isLight
    ? `h-3.5 w-3.5 shrink-0 transition-transform ${variant === "unassigned" ? "text-[rgb(var(--rb-text-muted))]" : "text-[rgb(var(--rb-text-secondary))]"} ${open ? "rotate-180" : ""}`
    : `h-3.5 w-3.5 shrink-0 transition-transform ${variant === "unassigned" ? "text-slate-500" : "text-slate-400"} ${open ? "rotate-180" : ""}`;

  const labelSpanClass = isLight ? "min-w-0 flex-1 truncate text-left" : "min-w-0 max-w-[90px] truncate";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((prev) => !prev);
        }}
        className={`${triggerLayout} focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${
          isLight
            ? "focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--rb-shell-bg))]"
            : "focus:ring-1 focus:ring-indigo-500/50"
        } ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={isLight ? `Assignee: ${selectedLabel}` : `Responsable: ${selectedLabel}`}
      >
        <span className={avatarClass} aria-hidden>
          {value ? (selectedLabel.trim() || "?").charAt(0).toUpperCase() : <User className="h-3.5 w-3.5" />}
        </span>
        <span className={labelSpanClass} title={selectedLabel}>
          {selectedLabel}
        </span>
        <ChevronDown className={chevronClass} aria-hidden />
      </button>
      {typeof document !== "undefined" && createPortal(dropdownContent, document.body)}
    </>
  );
}
