"use client";

/**
 * Reusable suggestion chips for Sapito assistant UIs.
 * Clicking a chip invokes onSelect with the chip text (e.g. to send as message).
 */

type AssistantSuggestionChipsProps = {
  suggestions: string[];
  onSelect: (text: string) => void;
  disabled?: boolean;
  className?: string;
  /** Use "dark" when inside dark cards (e.g. Project Copilot welcome). */
  variant?: "light" | "dark";
};

export function AssistantSuggestionChips({
  suggestions,
  onSelect,
  disabled = false,
  className = "",
  variant = "light",
}: AssistantSuggestionChipsProps) {
  if (suggestions.length === 0) return null;

  const buttonClass =
    variant === "dark"
      ? "rounded-full bg-slate-800 border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-emerald-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      : "rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <div
      className={`flex flex-wrap gap-2 ${className}`}
      role="group"
      aria-label="Sugerencias de consulta"
    >
      {suggestions.map((text, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => onSelect(text)}
          disabled={disabled}
          className={buttonClass}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
