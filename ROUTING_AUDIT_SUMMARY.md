# Navigation / context routing audit — summary

## Objective

Ensure every page, action, and redirect respects **GLOBAL** vs **PROJECT** context: project workspace actions stay project-scoped; global workspace stays global.

---

## Modules reviewed

| Module | Scope | Status |
|--------|--------|--------|
| **Notes** | List, detail, new, back, delete redirect | ✅ Verified / fixed |
| **Tasks** | List, project tasks, activities links | ✅ Context-aware |
| **Tickets** | List, detail, new, back, delete, row actions | ✅ Fixed |
| **Knowledge / Spaces & Pages** | List, page editor, graph, breadcrumb, back, full editor | ✅ Fixed |
| **Knowledge Explorer** | documents, search | ✅ Global routes only (as designed) |
| **Sapito / search** | /knowledge/search | ✅ Global (no project search in scope) |
| **Project workspace** | Tabs, dashboard links, CTAs | ✅ Fixed |
| **Drawers / modals** | PageDetailDrawer, KnowledgePageRow “Open full editor” | ✅ fullEditorQuery added |
| **Empty-state CTAs** | Project notes/tickets/tasks new | ✅ Project-scoped |
| **Post-save / post-delete** | Notes, tickets redirects | ✅ Use listPath / get*Href |

---

## Incorrect routes found and corrections applied

### 1. **Ticket detail** (`app/(private)/tickets/[id]/page.tsx`)
- **Issue:** Back link and error/not-found redirects always went to global `/tickets`.
- **Fix:** Read `projectId` from `useSearchParams().get("projectId")`. Back and error links use `getTicketsListHref(ticket?.project_id ?? projectIdFromQuery)`. Pass `listPath={backHref}` to `ObjectActions` so delete/archive redirect to the same list.

### 2. **Project tickets list** (`app/(private)/projects/[id]/tickets/page.tsx`)
- **Issue:** Row click and row actions linked to `/tickets/[id]` without `?projectId=`, so ticket detail lost project context.
- **Fix:** Use `getTicketDetailHref(t.id, projectId)` for view/edit and row click so detail page receives `?projectId=` and back/delete stay in project.

### 3. **Project dashboard** (`app/(private)/projects/[id]/page.tsx`)
- **Issue:** “Today’s tickets” and recent items linked to `/tickets/[id]` and `/knowledge/[pageId]` without project context.
- **Fix:** Ticket links use `getTicketDetailHref(t.id, projectId)`. Knowledge page links use `/knowledge/[pageId]?projectId=${projectId}` so page editor and graph keep project context.

### 4. **Knowledge page editor** (`app/(private)/knowledge/[pageId]/page.tsx`)
- **Issue:** Error “Volver a Knowledge” and “Back to list” did not consistently use project context from URL; related-page links dropped `?projectId=`.
- **Fix:** `useSearchParams()` at top for `projectIdFromQuery`. Error link uses `getKnowledgeListHref(projectIdFromQuery)`. “Back to list” uses `getKnowledgeListHref(projectIdFromQuery ?? space?.project_id)`. Related knowledge links append `?projectId=${projectIdFromQuery}` when set. “View Graph” already appended `?projectId=` when present.

### 5. **Knowledge graph** (`app/(private)/knowledge/[pageId]/graph/page.tsx`)
- **Issue:** “Back to page” (both error and success views) used hardcoded `/knowledge/${pageId}` and dropped project context.
- **Fix:** `pageEditorHref = /knowledge/${pageId}` + `?projectId=...` when `projectIdFromQuery` is set. Both “Back to page” links use `pageEditorHref`. Node click already preserved `?projectId=`.

### 6. **PageDetailDrawer & KnowledgePageRow**
- **Issue:** “Open full editor” always went to `/knowledge/[id]` with no project context.
- **Fix:** Optional `fullEditorQuery` (e.g. `?projectId=xxx`). Project knowledge page passes `fullEditorQuery={projectId ? \`?projectId=${projectId}\` : undefined}` so full editor opens in project context.

### 7. **ObjectActions**
- **Issue:** Delete/archive redirect always used default global list path.
- **Fix:** Optional `listPath` prop. Ticket detail (and any caller in project context) passes `listPath={backHref}` so post-delete redirect stays in project when applicable.

### 8. **Central route helpers** (`lib/routes.ts`)
- **Added:** `getNotesListHref`, `getNotesNewHref`, `getNoteDetailHref`, `getTasksListHref`, `getTicketsListHref`, `getTicketDetailHref(ticketId, projectId?)`, `getTicketsNewHref`, `getKnowledgeListHref`, `getKnowledgePageEditorHref`, `getKnowledgeSearchHref`, `getKnowledgeExplorerHref` for consistent context-aware URLs.

---

## Intentional exceptions (global routing is correct)

- **Sidebar / AppShell:** Links to `/notes`, `/tasks`, `/tickets`, `/knowledge`, etc. are global nav; no change.
- **Dashboard:** Links to `/notes/new`, `/tickets`, `/tasks`, `/knowledge` are global entry points; correct.
- **Global tickets list** (`/tickets`): Row links to `/tickets/[id]` without `projectId`; correct for global context.
- **Global notes list** (`/notes`): Row links to `/notes/[id]`; note detail uses `note.project_id` for back/delete; correct.
- **QuickActionMenu:** Global quick actions point to global create routes; correct.
- **Command palette:** Already uses `projectId` for project-scoped “New ticket”, “Go to project tasks/notes/knowledge/tickets”; no change.
- **Knowledge documents/search:** `/knowledge/documents`, `/knowledge/search` are global; no project variants in scope.
- **Ticket detail “Open knowledge page”:** Link to `/knowledge/[pageId]` without `?projectId=` is acceptable (user can be in global ticket view); optional enhancement to pass ticket’s project_id if present.

---

## Result

- **In a project:** Create/edit/view/back/delete and “Open full editor” stay within that project’s routes where applicable.
- **Global:** List/detail/new and redirects remain on global routes.
- No layout, IA, or schema changes; only link and redirect behavior was updated.
