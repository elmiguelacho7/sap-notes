 "use client";
 
 import type { ReactNode } from "react";
 import { useEffect, useRef, useState } from "react";
 import Link from "next/link";
 import { Plus } from "lucide-react";
 import { Button } from "@/components/ui/Button";
 
 export type QuickActionItem = {
   label: string;
   href: string;
   icon?: ReactNode;
 };
 
 export function QuickActionMenu({
   label = "Crear",
   items,
   className = "",
 }: {
   label?: string;
   items: QuickActionItem[];
   className?: string;
 }) {
   const [open, setOpen] = useState(false);
   const ref = useRef<HTMLDivElement>(null);
 
   useEffect(() => {
     if (!open) return;
     const onKeyDown = (e: KeyboardEvent) => {
       if (e.key === "Escape") setOpen(false);
     };
     const onMouseDown = (e: MouseEvent) => {
       if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
     };
     document.addEventListener("keydown", onKeyDown);
     document.addEventListener("mousedown", onMouseDown);
     return () => {
       document.removeEventListener("keydown", onKeyDown);
       document.removeEventListener("mousedown", onMouseDown);
     };
   }, [open]);
 
   return (
     <div className={`relative ${className}`} ref={ref}>
       <Button
         variant="secondary"
         onClick={() => setOpen((v) => !v)}
         aria-expanded={open}
         aria-haspopup="menu"
       >
         <Plus className="h-[18px] w-[18px]" />
         {label}
       </Button>
 
       {open ? (
         <div
           className="absolute right-0 top-full z-50 mt-2 min-w-[220px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
           role="menu"
         >
           <div className="p-1">
             {items.map((item) => (
               <Link
                 key={item.href}
                 href={item.href}
                 role="menuitem"
                 onClick={() => setOpen(false)}
                 className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100/70 transition-colors"
               >
                 {item.icon ? <span className="text-slate-400">{item.icon}</span> : null}
                 <span className="truncate">{item.label}</span>
               </Link>
             ))}
           </div>
         </div>
       ) : null}
     </div>
   );
 }
