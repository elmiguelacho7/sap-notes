# Sapito single-engine consolidation — deliverables

## 1. Files changed

| File | Change |
|------|--------|
| **lib/ai/contextResolvers.ts** | **New.** `GlobalContextResolver` (`resolveGlobalContext`) and `ProjectContextResolver` (`resolveProjectContext`). Single place for what each mode loads. |
| **app/api/project-agent/route.ts** | Explicit `mode`: "global" \| "project"; derive from `projectId` if not sent. Use resolvers by mode. `effectiveProjectId = mode === "global" ? null : projectId`. [Sapito mode routing] log. 400 if mode=project and no projectId. |
| **lib/ai/sapitoContext.ts** | Delegates to `resolveGlobalContext` / `resolveProjectContext` by scope. Removed duplicated retrieval logic; kept `buildSapitoContext` for backward compatibility. |
| **components/ai/GlobalAssistantBubble.tsx** | Sends `mode: "global"`. Labels: "Global SAP Copilot". |
| **components/ai/ProjectAssistantChat.tsx** | Sends `mode: "project"`. Labels: "Project Copilot". |
| **components/ai/ProjectAssistantDock.tsx** | Labels: "Project Copilot", "Sapito con contexto de este proyecto". |

---

## 2. How the shared engine was organized

- **One API route:** `POST /api/project-agent`. Body: `message`, optional `projectId`, `userId`, `mode` ("global" | "project"), optional `scope` (for notes variant).
- **One agent:** `runProjectAgent(message, context, sessionId)` in `lib/langchain/projectAgent.ts`. Same intent classification (`classifySapIntent`), same prompts/chains, same answer formatting. Context shape differs by mode (project has notes/links/stats; global does not).
- **Context by mode:** The route chooses a **context resolver** by `mode`:
  - **mode = "global"** → `resolveGlobalContext({ message, sapIntent, notesVariant })` — no projectId, no project data.
  - **mode = "project"** → `resolveProjectContext({ projectId, userId, message, sapIntent })` — only that projectId.
- **Resolvers** live in `lib/ai/contextResolvers.ts`. They return `{ contextText, retrievalDebug, retrievalScopes }`. No duplication of retrieval logic: global path only calls global retrieval; project path only calls project-scoped + global fallback.

---

## 3. How global mode works

- **Entry point:** Global Sapito (bubble in main layout). Sends `mode: "global"`, `projectId: null`.
- **Context:** `GlobalContextResolver` loads:
  - **Workspace summary (optional):** Only when intent is workspace_summary; then platform stats (or notes insights if `scope: "notes"`). No project summaries, no project memory.
  - **Retrieval:** Only global SAP knowledge (`searchMultiTenantKnowledge(null, null, query)` — scope_type = 'global' only) and official SAP docs. No project documents, no project memory.
- **Isolation:** `effectiveProjectId` is forced to `null` in global mode, so no project-scoped retrieval or project data is ever requested.

---

## 4. How project mode works

- **Entry point:** Project Sapito (dock inside each project). Sends `mode: "project"`, `projectId` (required).
- **Context:** `ProjectContextResolver` loads:
  - **Workspace summary (optional):** When intent is project_status, project overview (tasks, tickets, activities) for that project only.
  - **Retrieval (in order):** Project memory → project documents (multitenant with that projectId + userId) → global SAP fallback (same multitenant call returns global scope) → official SAP docs. Never queries another project.
- **Isolation:** Only the request’s `projectId` is passed to `resolveProjectContext` and to multitenant/project-memory search. RPCs filter by `project_id` / `user_id`; no cross-project data.

---

## 5. How project isolation is enforced

- **Route:** If `mode === "global"`, `effectiveProjectId` is set to `null` before any context resolution or logging. Project mode requires `projectId` (400 otherwise).
- **Resolvers:** Global resolver never receives or uses a projectId. Project resolver receives a single `projectId` and uses it in every retrieval call; no other project id is ever passed.
- **RPC/DB:** `search_project_knowledge_memory(p_project_id, ...)` and `search_knowledge_documents_multitenant(p_project_id, ...)` filter by that id; no other project’s rows are returned.
- **Logging:** `[Sapito mode routing]` includes `mode`, `userId`, `projectId` (effective), `intent`, `workspaceContextIncluded`, `retrievalScopes` for audit.

---

## 6. Follow-up recommendations

1. **Optional mode in body:** Clients can omit `mode`; it is derived from presence of `projectId`. Sending `mode` explicitly is recommended for clarity and future-proofing.
2. **Notes page:** Still uses `scope: "notes"` with no projectId; mode becomes global and `notesVariant: true` gives notes insights for workspace summary. No change required on notes page.
3. **Conversation logs:** `conversation_logs.mode` and `project_id` are set from `mode` and `effectiveProjectId` so analytics stay correct.
4. **Future global memory:** If you add global (non-project) memory later, extend `GlobalContextResolver` only; project resolver stays unchanged.
5. **Tests:** Add an integration test that calls the route with `mode: "global"` and asserts no project-scoped RPC is called with a projectId, and with `mode: "project"` and projectId X that only X is passed to resolvers/RPCs.
