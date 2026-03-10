# Platform Data-Isolation Audit — SAP Notes Hub

**Scope:** Full platform audit for data visibility leaks using the current flat model (no workspace).  
**Rule:** A user must only see (1) their own personal data, (2) data from projects where they are explicitly a member, (3) platform settings only if superadmin.

---

## 1. Module-by-module audit table

| Module | Data source | Current scope | Safe? | Notes |
|--------|-------------|---------------|-------|--------|
| **Dashboard** | `supabase` (projects, notes), `/api/metrics/platform` | RLS on projects/notes; metrics by `userId` | ✅ | User client + RPC scoped to member/owned projects; superadmin branch in RPC. |
| **My Work** | `supabase` (projects, project_tasks, tickets, project_activities) | RLS; filter by assignee/owner (`profileId`) | ⚠️ | Projects/tasks/activities RLS = project membership. **Tickets:** RLS not found in migrations — confirm; if missing, direct client could see all tickets. |
| **Projects list** | `supabase` (projects, notes/tickets/tasks counts per project) | RLS on projects and notes | ✅ | Only member/owned projects; counts per project use same client (RLS). |
| **Project detail** | `supabase` + APIs (stats, notes, tickets, activities, links, etc.) | Mixed | ❌ | Many **APIs** take `projectId` from URL with **no membership check** (see Unsafe paths). |
| **Tasks (general board)** | `supabase` (`tasks` with `project_id` null) | RLS: owner or superadmin | ✅ | 20260404100000: tasks `project_id IS NULL` → created_by = auth.uid() or superadmin. |
| **Project tasks** | `supabase` (`project_tasks`) | RLS by project membership | ✅ | project_tasks RLS = member of project. |
| **Activities** | `supabase` (`project_activities`) | RLS by project membership | ✅ | project_activities RLS = member. |
| **Tickets** | `supabase` (tickets) + PATCH `/api/tickets/[id]` | Unclear / unsafe | ❌ | **RLS on `tickets` not found in migrations.** If no RLS, any user can read all tickets. **PATCH** updates any ticket by id without project membership check. |
| **Knowledge (global)** | `supabase` (knowledge_spaces, knowledge_pages) | RLS on knowledge_* | ✅ | User client; RLS by owner/project. |
| **Knowledge (project)** | `supabase` + GET `/api/projects/[id]/knowledge` | RLS + API | ❌ | **GET** returns project knowledge notes with **no auth/membership** (supabaseAdmin). |
| **Notes (global)** | `supabase` (notes, `project_id` null) | RLS: superadmin only | ✅ | 20260404110000. |
| **Notes (project)** | GET/POST `/api/projects/[id]/notes` | API: membership checked | ✅ | isProjectMember or superadmin before getProjectNotes. |
| **AI / project-agent** | APIs + getNotesInsights, getProjectMetrics, getProjectNotes | Mixed | ✅ | project mode: **membership check added**. Global: getNotesInsights(userId) scoped. |
| **Platform metrics** | GET `/api/metrics/platform` | By userId from request | ✅ | getPlatformMetrics(userId). |
| **Project stats** | GET `/api/projects/[id]/stats` | supabaseAdmin, no auth | ❌ | **No auth or membership check.** |
| **Activity stats** | GET `/api/projects/[id]/activity-stats` | supabaseAdmin, no auth | ❌ | **No auth or membership check.** |
| **Project brain** | GET `/api/projects/[id]/brain` | supabaseAdmin, no auth | ❌ | **No auth or membership check;** returns project memory. |
| **Project links** | GET/POST `/api/projects/[id]/links` | supabaseAdmin, no auth | ❌ | **No auth or membership check.** |
| **Project sources** | GET/POST `/api/projects/[id]/sources` | supabaseAdmin; POST has userId | ❌ | **GET** no check; **POST** uses userId but does not verify membership. |
| **Activate plan** | GET `/api/projects/[id]/activate-plan` | Auth only, no membership | ❌ | Any authenticated user can read any project’s activate plan. |
| **Generate plan** | POST `/api/projects/[id]/generate-plan` | Auth only, no membership | ❌ | Any authenticated user can generate plan for any project. |
| **Generate-activate-plan** | POST `/api/projects/[id]/generate-activate-plan` | Membership or superadmin | ✅ | Checks project_members or superadmin. |
| **Project permissions** | GET `/api/projects/[id]/permissions` | By user + isProjectOwner | ✅ | Returns booleans; no project data leak. |
| **Archive** | PATCH `/api/projects/[id]/archive` | isProjectOwner or superadmin | ✅ | Safe. |
| **Notes PATCH/DELETE** | `/api/notes/[id]` | Project/superadmin check | ✅ | Note’s project_id + membership or superadmin. |
| **Admin** | Various, requireSuperAdminFromRequest | Platform-scoped | ✅ | Superadmin-only routes. |

---

## 2. Unsafe paths found

| # | Path | Pattern | Risk |
|---|------|---------|------|
| 1 | **GET /api/projects/[id]/stats** | projectId from URL; no auth/membership | Any user can get notes/ticket counts and stats for any project. |
| 2 | **GET /api/projects/[id]/activity-stats** | projectId from URL; no auth | Any user can get activity stats for any project. |
| 3 | **GET /api/projects/[id]/brain** | projectId from URL; no auth | Any user can get project memory (extracted from notes) for any project. |
| 4 | **GET /api/projects/[id]/links** | projectId from URL; no auth | Any user can list project links. |
| 5 | **POST /api/projects/[id]/links** | projectId from URL; no auth | Any user can create a link in any project. |
| 6 | **GET /api/projects/[id]/knowledge** | projectId from URL; no auth | Any user can get project knowledge notes. |
| 7 | **POST /api/projects/[id]/knowledge** | projectId from URL; body.userId only | Any user can create knowledge entry for any project (userId in body not validated as requester/member). |
| 8 | **GET /api/projects/[id]/sources** | projectId from URL; no auth | Any user can list project sources. |
| 9 | **POST /api/projects/[id]/sources** | projectId from URL; createdBy set but no membership | Any user can add a source to any project. |
| 10 | **GET /api/projects/[id]/activate-plan** | projectId from URL; auth but no membership | Any authenticated user can read activate plan (phases, tasks) for any project. |
| 11 | **POST /api/projects/[id]/generate-plan** | projectId from URL; auth but no membership | Any authenticated user can generate plan for any project. |
| 12 | **PATCH /api/tickets/[id]** | ticketId from URL; auth but no project check | Any authenticated user can update (e.g. close) any ticket. |
| 13 | **tickets table** | Direct Supabase client reads | If RLS is not enabled on `tickets`, any user can read all tickets. **Verify RLS.** |

---

## 3. Minimal fixes recommended (current flat model)

- **Same pattern for all project-scoped GET/POST APIs:** Resolve `userId` from request (e.g. `getCurrentUserIdFromRequest`). If no user, return 401. Then require **project membership or superadmin** (e.g. `isProjectMember(userId, projectId) || requireSuperAdminFromRequest(req)`) before calling any service that uses `supabaseAdmin` or returns project data. Return 403 if not allowed.

| Fix | API / area | Change |
|-----|------------|--------|
| F1 | GET/POST `/api/projects/[id]/links` | Add auth + `isProjectMember(userId, projectId)` or superadmin before getProjectLinks / createProjectLink. |
| F2 | GET `/api/projects/[id]/stats` | Add auth + membership (or superadmin) before getProjectStats. |
| F3 | GET `/api/projects/[id]/activity-stats` | Add auth + membership (or superadmin) before getProjectActivityStats. |
| F4 | GET `/api/projects/[id]/brain` | Add auth + membership (or superadmin) before getProjectMemory. |
| F5 | GET/POST `/api/projects/[id]/knowledge` | Add auth + membership (or superadmin) before getProjectKnowledgeNotes / createKnowledgeEntry. Validate body.userId = requester or drop and use requester. |
| F6 | GET/POST `/api/projects/[id]/sources` | Add auth + membership (or superadmin) before getProjectSources / createProjectSource. |
| F7 | GET `/api/projects/[id]/activate-plan` | Add membership (or superadmin) after auth; return 403 if no access. |
| F8 | POST `/api/projects/[id]/generate-plan` | Add membership (or superadmin) after auth; return 403 if no access. |
| F9 | PATCH `/api/tickets/[id]` | Load ticket by id; get `project_id`; require `isProjectMember(userId, projectId)` or superadmin before update. |
| F10 | **tickets table** | If RLS is missing: add RLS policy so SELECT/UPDATE/DELETE allowed only when user is project member or superadmin (same pattern as notes: project_id in accessible projects). |

---

## 4. Which fixes to implement first

**Priority order (by impact and ease):**

1. **F2, F3, F4** — Project stats, activity-stats, brain: high impact (leak of counts and project memory), small change (add same auth+membership block).
2. **F9** — PATCH tickets: any user can change any ticket status; add project membership check.
3. **F1, F5, F6** — Links, knowledge, sources: prevent read/write of project data by non-members.
4. **F7, F8** — Activate plan read, generate plan: prevent non-members from reading or generating plans.
5. **F10** — tickets RLS: verify in DB; if missing, add RLS so all direct client reads are scoped.

**Suggested batch:** Implement F2, F3, F4, F9 first (one shared helper: `requireProjectAccess(req, projectId)` returning 401/403 or userId), then F1, F5, F6, F7, F8, then F10 if needed.

**Implemented in this pass:** Helper `requireProjectAccess(request, projectId)` in `lib/auth/serverAuth.ts`; F2 (stats), F3 (activity-stats), F4 (brain), F9 (tickets PATCH) now enforce auth + project access.

---

## 5. Modules that will need workspace scope later

When a **workspace_id** (or equivalent) is introduced:

| Module | Workspace need |
|--------|-----------------|
| **Dashboard** | Aggregate only within user’s workspace; platform metrics RPC filter by workspace. |
| **My Work** | Tasks/tickets/activities from projects in user’s workspace only (already project-scoped; workspace = filter on project set). |
| **Projects list** | Restrict to projects in user’s workspace (today: member/owner; later: member/owner + same workspace). |
| **Project detail** | No extra change if project access already implies workspace (project.workspace_id = user’s workspace). |
| **Tasks / Activities / Tickets** | Already project-scoped; workspace = which projects are in scope. |
| **Knowledge (global)** | “Global” may become workspace-scoped (e.g. spaces/pages in user’s workspace). |
| **Knowledge (project)** | Project already in a workspace; no extra field if project.workspace_id is source of truth. |
| **Notes (global)** | Reclassify as workspace-shared notes (notes.workspace_id); visibility = same workspace. |
| **Notes (project)** | Already project-scoped; workspace = project’s workspace. |
| **AI / project-agent** | Restrict project resolution and context to user’s workspace; getNotesInsights already user-scoped, can add workspace filter. |
| **Platform metrics** | Restrict to workspace (or superadmin sees all). |
| **Project stats / brain / links / sources** | Already project-scoped; access check will include “project in user’s workspace”. |
| **Admin** | Superadmin remains platform-wide; workspace admin role would limit to own workspace. |

---

## 6. Summary

- **Current model:** Flat; access = identity + project membership (or superadmin). No workspace.
- **Unsafe:** Multiple project-scoped APIs use `projectId` from URL without checking membership; PATCH tickets has no project check; tickets table RLS unclear.
- **Minimal fix:** Add auth + membership (or superadmin) to every project-scoped API; add project check to PATCH tickets; verify/add RLS on tickets.
- **First steps:** F2, F3, F4, F9 (stats, activity-stats, brain, tickets PATCH), then links/knowledge/sources, then activate/generate plan, then tickets RLS if missing.
- **Later:** Introduce workspace_id on profiles and projects; scope dashboard, projects list, “global” notes, and metrics by workspace; add workspace-scoped admin role if needed.
