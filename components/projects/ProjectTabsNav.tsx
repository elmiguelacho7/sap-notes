import { TabsNav } from "@/components/ui/TabsNav";
import { LayoutDashboard, CalendarDays, ListTodo, CheckSquare, FileText, Link as LinkIcon, BookOpen, Ticket, Brain, Users } from "lucide-react";

export function ProjectTabsNav({
  projectId,
  className = "",
  variant = "light",
}: {
  projectId: string;
  className?: string;
  variant?: "light" | "dark";
}) {
  const base = `/projects/${projectId}`;
  const iconClass = "h-[18px] w-[18px] shrink-0";

  return (
    <TabsNav
      variant={variant}
      className={className}
      items={[
        { label: "Overview", href: base, exact: true, icon: <LayoutDashboard className={iconClass} /> },
        { label: "Planning", href: `${base}/planning`, icon: <CalendarDays className={iconClass} /> },
        { label: "Activities", href: `${base}/planning/activities`, icon: <ListTodo className={iconClass} /> },
        { label: "Tasks", href: `${base}/tasks`, icon: <CheckSquare className={iconClass} /> },
        { label: "Notes", href: `${base}/notes`, icon: <FileText className={iconClass} /> },
        { label: "Brain", href: `${base}/brain`, icon: <Brain className={iconClass} /> },
        { label: "Links", href: `${base}/links`, icon: <LinkIcon className={iconClass} /> },
        { label: "Knowledge", href: `${base}/knowledge`, icon: <BookOpen className={iconClass} /> },
        { label: "Tickets", href: `${base}/tickets`, icon: <Ticket className={iconClass} /> },
        { label: "Equipo", href: `${base}/members`, icon: <Users className={iconClass} /> },
      ]}
    />
  );
}
