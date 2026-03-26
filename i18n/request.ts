import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  type AppLocale,
  isAppLocale,
} from "./config";

async function loadMessages(locale: AppLocale) {
  if (locale === "es") {
    const [common, auth, sidebar, dashboard, tasks, tickets, projects, planning, activities, calendar, knowledge, brain, sapito, notes, account, admin, links, projectSearch] = await Promise.all([
      import("../messages/es/common.json"),
      import("../messages/es/auth.json"),
      import("../messages/es/sidebar.json"),
      import("../messages/es/dashboard.json"),
      import("../messages/es/tasks.json"),
      import("../messages/es/tickets.json"),
      import("../messages/es/projects.json"),
      import("../messages/es/planning.json"),
      import("../messages/es/activities.json"),
      import("../messages/es/calendar.json"),
      import("../messages/es/knowledge.json"),
      import("../messages/es/brain.json"),
      import("../messages/es/sapito.json"),
      import("../messages/es/notes.json"),
      import("../messages/es/account.json"),
      import("../messages/es/admin.json"),
      import("../messages/es/links.json"),
      import("../messages/es/projectSearch.json"),
    ]);
    return {
      common: common.default,
      auth: auth.default,
      sidebar: sidebar.default,
      dashboard: dashboard.default,
      tasks: tasks.default,
      tickets: tickets.default,
      projects: projects.default,
      planning: planning.default,
      activities: activities.default,
      calendar: calendar.default,
      knowledge: knowledge.default,
      brain: brain.default,
      sapito: sapito.default,
      notes: notes.default,
      account: account.default,
      admin: admin.default,
      links: links.default,
      projectSearch: projectSearch.default,
    };
  }
  const [common, auth, sidebar, dashboard, tasks, tickets, projects, planning, activities, calendar, knowledge, brain, sapito, notes, account, admin, links, projectSearch] = await Promise.all([
    import("../messages/en/common.json"),
    import("../messages/en/auth.json"),
    import("../messages/en/sidebar.json"),
    import("../messages/en/dashboard.json"),
    import("../messages/en/tasks.json"),
    import("../messages/en/tickets.json"),
    import("../messages/en/projects.json"),
    import("../messages/en/planning.json"),
    import("../messages/en/activities.json"),
    import("../messages/en/calendar.json"),
    import("../messages/en/knowledge.json"),
    import("../messages/en/brain.json"),
    import("../messages/en/sapito.json"),
    import("../messages/en/notes.json"),
    import("../messages/en/account.json"),
    import("../messages/en/admin.json"),
    import("../messages/en/links.json"),
    import("../messages/en/projectSearch.json"),
  ]);
  return {
    common: common.default,
    auth: auth.default,
    sidebar: sidebar.default,
    dashboard: dashboard.default,
    tasks: tasks.default,
    tickets: tickets.default,
    projects: projects.default,
    planning: planning.default,
    activities: activities.default,
    calendar: calendar.default,
    knowledge: knowledge.default,
    brain: brain.default,
    sapito: sapito.default,
    notes: notes.default,
    account: account.default,
    admin: admin.default,
    links: links.default,
    projectSearch: projectSearch.default,
  };
}

/**
 * Ribbit: next-intl for messages only — no locale-based routing (no /en, /es in URL).
 *
 * Locale resolution: NEXT_LOCALE cookie only (see i18n/config.ts). Default: "en".
 * Do not add pathname-based or requestLocale-driven logic here, and do not introduce
 * app/[locale]/... — that would change URL structure. Architecture: docs/i18n.md
 *
 * Runs per RSC request; feeds getLocale() / getMessages() in the root layout.
 */
export default getRequestConfig(async () => {
  const jar = await cookies();
  // NEXT_LOCALE only — not Accept-Language or URL segments
  const raw = jar.get(LOCALE_COOKIE_NAME)?.value;
  const locale: AppLocale = isAppLocale(raw) ? raw : DEFAULT_LOCALE;

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
