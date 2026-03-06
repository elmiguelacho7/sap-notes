 import type { ReactNode } from "react";
 
 export function AppShell({
   sidebar,
   topbar,
   children,
 }: {
   sidebar: ReactNode;
   topbar: ReactNode;
   children: ReactNode;
 }) {
   return (
     <main className="min-h-screen bg-slate-50 flex">
       {sidebar}
       <div className="flex-1 min-w-0 flex flex-col min-h-0">
         {topbar}
         <section className="flex-1 min-h-0 overflow-auto bg-slate-50">{children}</section>
       </div>
     </main>
   );
 }
