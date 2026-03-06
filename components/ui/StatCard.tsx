 import type { ReactNode } from "react";
 
 type Accent = "indigo" | "blue" | "violet" | "emerald" | "amber" | "red" | "slate";
 
 const accentDot: Record<Accent, string> = {
   indigo: "bg-indigo-600",
   blue: "bg-blue-500",
   violet: "bg-violet-500",
   emerald: "bg-emerald-500",
   amber: "bg-amber-500",
   red: "bg-red-500",
   slate: "bg-slate-400",
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
     <div className={`rounded-2xl border border-slate-200 bg-white p-6 ${className}`}>
       <div className="flex items-start justify-between gap-3">
         <div className="min-w-0">
           <div className="flex items-center gap-2">
             <span className={`h-2 w-2 rounded-full ${accentDot[accent]}`} aria-hidden />
             <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
               {label}
             </p>
           </div>
           <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
             {value}
           </div>
         </div>
         {icon ? (
           <div className="shrink-0 text-slate-400">{icon}</div>
         ) : null}
       </div>
       {hint ? <div className="mt-1 text-xs text-slate-600">{hint}</div> : null}
     </div>
   );
 }
