 import type { ReactNode } from "react";
 
 export function Sidebar({
   collapsed,
   header,
   children,
   footer,
 }: {
   collapsed: boolean;
   header: ReactNode;
   children: ReactNode;
   footer: ReactNode;
 }) {
   return (
     <aside
       className={`bg-white border-r border-slate-200 flex flex-col transition-[width] duration-300 ease-in-out shrink-0 ${
         collapsed ? "w-16" : "w-60"
       }`}
     >
       {header}
       <nav className="flex-1 px-2 py-4 space-y-3 text-sm overflow-y-auto min-h-0">{children}</nav>
       {footer}
     </aside>
   );
 }
 
 export function SidebarSection({
   label,
   collapsed,
   children,
 }: {
   label: string;
   collapsed: boolean;
   children: ReactNode;
 }) {
   return (
     <div className="space-y-1">
       {!collapsed ? (
         <p className="px-3 pt-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
           {label}
         </p>
       ) : null}
       <div className="space-y-0.5">{children}</div>
     </div>
   );
 }
