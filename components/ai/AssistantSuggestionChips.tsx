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
};

export function AssistantSuggestionChips({
  suggestions,
  onSelect,
  disabled = false,
  className = "",
}: AssistantSuggestionChipsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap justify-center gap-2 ${className}`}
      role="group"
      aria-label="Sugerencias de consulta"
    >
      {suggestions.map((text, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => onSelect(text)}
          disabled={disabled}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
