 import type { ReactNode } from "react";
 
 type Tone = "neutral" | "brand" | "ai" | "success" | "warning" | "error" | "info";
 
 const toneClasses: Record<Tone, string> = {
   neutral: "bg-slate-100 text-slate-700",
   brand: "bg-indigo-50 text-indigo-700",
   ai: "bg-violet-50 text-violet-700",
   success: "bg-emerald-50 text-emerald-700",
   warning: "bg-amber-50 text-amber-800",
   error: "bg-red-50 text-red-700",
   info: "bg-blue-50 text-blue-700",
 };
 
 export function StatusBadge({
   children,
   tone = "neutral",
   className = "",
   dot = false,
 }: {
   children: ReactNode;
   tone?: Tone;
   className?: string;
   dot?: boolean;
 }) {
   return (
     <span
       className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${toneClasses[tone]} ${className}`}
     >
       {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
       {children}
     </span>
   );
 }
