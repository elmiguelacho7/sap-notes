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
    <main className="min-h-screen rb-shell-bg flex">
       {sidebar}
       <div className="flex-1 min-w-0 flex flex-col min-h-0">
         {topbar}
        <section className="flex-1 min-h-0 overflow-auto rb-workspace-bg">{children}</section>
       </div>
     </main>
   );
 }
