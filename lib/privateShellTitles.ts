import type { BreadcrumbItem } from "@/components/ui/header/Breadcrumbs";

/** Path → key under common.shell.pages (exact match). */
export const SHELL_PAGE_PATH_TO_KEY: Record<string, string> = {
  "/dashboard": "dashboard",
  "/my-work": "myWork",
  "/notes": "notes",
  "/tasks": "tasks",
  "/projects": "projects",
  "/knowledge": "knowledgeExplorer",
  "/knowledge/search": "knowledgeSearch",
  "/knowledge/documents": "spaces",
  "/knowledge/spaces": "documents",
  "/search": "search",
  "/tickets": "tickets",
  "/reports": "reports",
  "/process-flows": "processFlows",
  "/account": "settings",
  "/admin": "administration",
  "/clients": "clients",
};

type TShell = (key: string) => string;

export function getShellPageTitle(path: string, t: TShell): string {
  const key = SHELL_PAGE_PATH_TO_KEY[path];
  if (key) return t(`pages.${key}`);
  if (path.startsWith("/projects/") && path !== "/projects") return t("pages.project");
  if (path.startsWith("/notes/")) return t("pages.note");
  if (path.startsWith("/knowledge/")) return t("pages.knowledge");
  if (path.startsWith("/tickets")) return t("pages.tickets");
  if (path.startsWith("/reports")) return t("pages.reports");
  if (path.startsWith("/tasks")) return t("pages.tasks");
  if (path.startsWith("/my-work")) return t("pages.myWork");
  if (path.startsWith("/clients")) return t("pages.clients");
  return t("defaultTitle");
}

export function buildShellBreadcrumbs(pathname: string, t: TShell): BreadcrumbItem[] {
  if (!pathname || pathname === "/") {
    return [{ label: t("pages.dashboard"), href: "/dashboard" }];
  }
  if (pathname.startsWith("/projects/") && pathname !== "/projects") {
    return [{ label: t("pages.projects"), href: "/projects" }];
  }
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [{ label: getShellPageTitle(pathname, t) }];
  const items: BreadcrumbItem[] = [];
  let acc = "";
  for (let i = 0; i < segments.length; i++) {
    acc += `/${segments[i]}`;
    const isLast = i === segments.length - 1;
    items.push({
      label: getShellPageTitle(acc, t),
      href: isLast ? undefined : acc,
    });
  }
  return items;
}
