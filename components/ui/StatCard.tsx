 import type { ReactNode } from "react";
 
 type Accent = "indigo" | "blue" | "violet" | "emerald" | "amber" | "red" | "slate";
 
 const accentDot: Record<Accent, string> = {
  indigo: "bg-[rgb(var(--rb-brand-primary))]",
  blue: "bg-sky-500",
  violet: "bg-teal-500",
   emerald: "bg-emerald-500",
   amber: "bg-amber-500",
   red: "bg-red-500",
  slate: "bg-[rgb(var(--rb-text-muted))]",
 };
 
 export function StatCard({
   label,
   value,
   hint,
   icon,
   accent = "indigo",
   className = "",
 }: {
   label: string;
   value: ReactNode;
   hint?: ReactNode;
   icon?: ReactNode;
   accent?: Accent;
   className?: string;
 }) {
   return (
    <div className={`rounded-2xl border border-[rgb(var(--rb-surface-border))]/85 bg-[rgb(var(--rb-surface))]/95 p-6 ${className}`}>
       <div className="flex items-start justify-between gap-3">
         <div className="min-w-0">
           <div className="flex items-center gap-2">
             <span className={`h-2 w-2 rounded-full ${accentDot[accent]}`} aria-hidden />
            <p className="text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">
               {label}
             </p>
           </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-[rgb(var(--rb-text-primary))]">
             {value}
           </div>
         </div>
         {icon ? (
          <div className="shrink-0 text-[rgb(var(--rb-text-muted))]">{icon}</div>
         ) : null}
       </div>
      {hint ? <div className="mt-1 text-xs text-[rgb(var(--rb-text-secondary))]">{hint}</div> : null}
     </div>
   );
 }
