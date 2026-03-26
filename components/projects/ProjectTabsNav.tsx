import { TabsNav } from "@/components/ui/TabsNav";
import { LayoutDashboard, CalendarDays, ListTodo, CheckSquare, FileText, Link as LinkIcon, BookOpen, Ticket, Brain, Users } from "lucide-react";
import { useTranslations } from "next-intl";

export function ProjectTabsNav({
  projectId,
  className = "",
  variant = "light",
}: {
  projectId: string;
  className?: string;
  variant?: "light" | "dark";
}) {
  const t = useTranslations("projects.tabs");
  const base = `/projects/${projectId}`;
  const iconClass = "h-[18px] w-[18px] shrink-0";

  return (
    <TabsNav
      variant={variant}
      className={className}
      items={[
        { label: t("overview"), href: base, exact: true, icon: <LayoutDashboard className={iconClass} /> },
        { label: t("planning"), href: `${base}/planning`, icon: <CalendarDays className={iconClass} /> },
        { label: t("activities"), href: `${base}/planning/activities`, icon: <ListTodo className={iconClass} /> },
        { label: t("tasks"), href: `${base}/tasks`, icon: <CheckSquare className={iconClass} /> },
        { label: t("notes"), href: `${base}/notes`, icon: <FileText className={iconClass} /> },
        { label: t("brain"), href: `${base}/brain`, icon: <Brain className={iconClass} /> },
        { label: t("links"), href: `${base}/links`, icon: <LinkIcon className={iconClass} /> },
        { label: t("knowledge"), href: `${base}/knowledge`, icon: <BookOpen className={iconClass} /> },
        { label: t("tickets"), href: `${base}/tickets`, icon: <Ticket className={iconClass} /> },
        { label: t("team"), href: `${base}/members`, icon: <Users className={iconClass} /> },
      ]}
    />
  );
}
