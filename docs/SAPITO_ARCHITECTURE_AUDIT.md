# Sapito (AI Assistant) — Architecture & Capability Audit

**Repository:** SAP Notes Hub / Project Hub (Next.js + Supabase)  
**Audit type:** Architecture and capability only — no code changes.  
**Searched terms:** sapito, assistant, agent, ai, chat, project-agent, openai, langchain, metrics, knowledge, embeddings.

---

## 1. Sapito Architecture

### 1.1 Overview

Sapito is a **single-engine** AI assistant with two entry points (global and project). One API route and one LangChain agent handle both; context and retrieval differ by **mode** (`global` | `project`).

### 1.2 Frontend components

| Component | Location | Role |
|-----------|----------|------|
| **GlobalAssistantBubble** | `components/ai/GlobalAssistantBubble.tsx` | Floating bubble in main layout. Sends `mode: "global"`, no `projectId`. Labels: "Sapito", "Global SAP Copilot". |
| **ProjectAssistantDock** | `components/ai/ProjectAssistantDock.tsx` | Dock inside each project layout. Renders **ProjectAssistantChat** with `projectId` and `projectName`. Labels: "Project Copilot", "Sapito con contexto de este proyecto". |
| **ProjectAssistantChat** | `components/ai/ProjectAssistantChat.tsx` | Chat UI for project mode. POSTs to `/api/project-agent` with `message`, `projectId`, `mode: "project"`. |
| **SapitoAvatar** | `components/ai/SapitoAvatar.tsx` | Avatar/thinking image; uses `lib/agents/agentRegistry.ts` for paths (e.g. `/agents/sapito/sapito-avatar-40.png`). |
| **AssistantMessageContent** | `components/ai/AssistantMessageContent.tsx` | Renders assistant reply with markdown-style formatting (headings, lists). |
| **AssistantSuggestionChips** | `components/ai/AssistantSuggestionChips.tsx` | Suggestion chips for quick prompts. |

**Notes page** (`app/(private)/notes/page.tsx`) also uses the same agent: calls `/api/project-agent` with `scope: "notes"` (or `global-notes`), no `projectId`; mode becomes global with **notes variant** (insights from notes base instead of platform summary).

### 1.3 API route

- **Single route:** `POST /api/project-agent` (`app/api/project-agent/route.ts`).
- **Body:** `message` (required), optional `projectId`, `userId`, `sessionId`, `scope`, `mode` (`"global"` | `"project"`).
- **Flow:** Resolves `mode` (from body or derived: projectId present → project, else global). Resolves context via **context resolvers** (`resolveGlobalContext` or `resolveProjectContext`). Classifies intent (`classifySapIntent`). Builds `AgentContext` and calls `runProjectAgent(message, context, sessionId)`. Logs to `conversation_logs`. Returns `{ reply, grounded?, groundingLabel?, debug? }`.

### 1.4 Backend logic (context + agent)

- **Context resolvers** (`lib/ai/contextResolvers.ts`):  
  - **Global:** `resolveGlobalContext` — platform summary (or notes insights when notes variant), weekly focus (if intent), official SAP + multi-tenant global knowledge retrieval.  
  - **Project:** `resolveProjectContext` — project summary (metrics), optional project health/risk tools, weekly focus, project memory + project/global documents + official SAP retrieval.
- **Context builder (legacy entry):** `lib/ai/sapitoContext.ts` — `buildSapitoContext` delegates to the resolvers by scope; used for backward compatibility.
- **Intent:** `lib/ai/sapitoIntent.ts` — `classifySapIntent` (regex/keywords, no LLM). Categories: `sap_error`, `sap_transaction`, `sap_customizing`, `sap_process`, `sap_solution_design`, `workspace_summary`, `project_status`, `project_risk`, `weekly_focus`, `generic`.
- **Agent:** `lib/langchain/projectAgent.ts` — single `runProjectAgent`. Uses **ChatOpenAI** (gpt-4o-mini), **PromptTemplate**, and one of four system prompts (PROJECT, GLOBAL, NOTES, SAP_KNOWLEDGE) depending on intent and mode. Injects `sapitoContextSummary`, `knowledgeInstruction`, `sapFormatInstruction`, `projectContext`, and user message.

### 1.5 Integration with OpenAI / LangChain

- **OpenAI:**  
  - **Chat:** `@langchain/openai` → `ChatOpenAI` with `modelName: "gpt-4o-mini"`, `temperature: 0.2`.  
  - **Embeddings:** `openai.embeddings.create` with `text-embedding-3-small` (1536 dims) in `lib/ai/knowledgeSearch.ts`, `lib/knowledge/ingestHelpers.ts`, scripts (ingest, sap-doc-ingestion), and sync routes.
- **LangChain:**  
  - `ChatOpenAI`, `PromptTemplate`, `HumanMessage` from `@langchain/core`.  
  - No LangChain retrieval chains in the app; retrieval is custom (Supabase RPCs + embedding in app code).

---

## 2. API Endpoints

### 2.1 AI / assistant

| Endpoint | Method | Purpose | Data queried | Model / chain |
|----------|--------|---------|--------------|----------------|
| **/api/project-agent** | POST | Single Sapito entry: global or project chat. | Depends on mode. Global: platform metrics (RPC), notes insights (notes table), weekly focus, official SAP + multi-tenant knowledge. Project: project metrics (RPC), project notes/links/stats, project memory, project/global docs, official SAP. Optional: project health/risk tools. | LangChain `runProjectAgent` → ChatOpenAI **gpt-4o-mini**. No tool-calling loop; tools (health/risk) are invoked by resolver when intent detected. |

### 2.2 Metrics (used by dashboard and Sapito context)

| Endpoint | Method | Purpose | Data queried | Model |
|----------|--------|---------|--------------|--------|
| **/api/metrics/platform** | GET | Platform KPI for current user (dashboard + same numbers as Sapito). | Auth from request → `getPlatformMetrics(userId)` → RPC **get_platform_metrics(p_user_id)**. | None (read-only RPC). |

### 2.3 Other API routes (not AI-specific but relevant)

- **/api/projects/[id]/notes** — creates project note; can trigger project memory extraction (`storeProjectMemory`).
- **/api/tickets/[id]** — PATCH; on status → closed, triggers project memory extraction.
- **/api/projects/[id]/sources/[sourceId]/sync** — syncs project sources; after processing files, can trigger project memory extraction.
- **/api/admin/knowledge-sources**, **/api/admin/knowledge-sources/[id]/sync** — manage and sync knowledge sources (feed `knowledge_documents` for Sapito retrieval).

---

## 3. Data Sources Used by Sapito

| Source | How Sapito uses it |
|--------|--------------------|
| **projects** | Project name, scope; project summary uses project id/name. RLS limits visibility; metrics RPC uses member/created_by. |
| **project_members** | Access scope for metrics and project-scoped retrieval; RPCs filter by user_id. |
| **notes** | Project notes (titles, body, module, error_code, etc.) injected in project context; **getNotesInsights** aggregates module/error_code/transaction for notes variant. Soft-delete: `deleted_at IS NULL`. |
| **tickets** | Counts (open, high priority) in project overview; ticket closures feed **project_knowledge_memory**. |
| **knowledge_documents** | Chunked docs with **embedding** (1536). Semantic search via **search_knowledge_documents**, **search_project_knowledge_documents**, **search_knowledge_documents_multitenant**, **search_official_sap_knowledge**. Sapito retrieval uses these RPCs. |
| **knowledge_sources** | Metadata for sources; sync jobs populate `knowledge_documents`. Document type (e.g. sap_help, sap_official) used for official SAP layer. |
| **project_knowledge_memory** | Problem/solution memory per project (and user). **search_project_knowledge_memory** used first in project retrieval; then project docs + global. |
| **project_links** | Listed in project context (name, url, link_type). |
| **project_sources** | External sources per project; sync feeds knowledge_documents. |
| **project_tasks** | Counts (open, overdue, blocked) for project overview. |
| **project_activities** | Counts (overdue, upcoming) for project overview. |
| **profiles** | `app_role` for superadmin in metrics; user identity. |
| **conversation_logs** | Each agent response is logged (project_id, user_id, mode, user_message, assistant_reply). |
| **Metrics RPCs** | **get_platform_metrics(p_user_id)** → platform KPIs for context. **get_project_metrics(p_project_id, p_user_id)** → single-project metrics for project summary. |

---

## 4. Knowledge / RAG Layer

### 4.1 Embeddings

- **Model:** OpenAI **text-embedding-3-small** (1536 dimensions).
- **Where generated:**  
  - `lib/ai/knowledgeSearch.ts` — query embedding for search.  
  - `lib/knowledge/ingestHelpers.ts` — chunk embedding on ingest.  
  - `scripts/ingestKnowledge.ts`, `scripts/sap-doc-ingestion/importSapDocs.ts` — bulk ingest.  
  - `lib/ai/projectMemory.ts` — embedding for project memory (solution text).  
  - Sync routes: `app/api/projects/[id]/sources/[sourceId]/sync/route.ts`, `app/api/admin/knowledge-sources/[id]/sync/route.ts`, `app/api/integrations/google/sync/route.ts`.

### 4.2 pgvector

- **Extension:** Enabled in `supabase/migrations/20260306000000_knowledge_documents_pgvector.sql`.
- **Tables with vector column:**  
  - **knowledge_documents** — `embedding vector(1536)`; IVFFlat index (cosine).  
  - **project_knowledge_memory** — `embedding vector(1536)`; IVFFlat index.

### 4.3 Semantic search (RPCs)

- **search_knowledge_documents** — global knowledge (e.g. `project_id IS NULL` in later migrations).  
- **search_project_knowledge_documents** — project-scoped knowledge_documents.  
- **search_knowledge_documents_multitenant** — by `p_project_id`, `p_user_id`; returns global and/or project/user scoped with priority.  
- **search_official_sap_knowledge** — `document_type IN ('sap_help','sap_official')`, global.  
- **search_project_knowledge_memory** — project + user filtered; used for “project experience” first.

Implemented in **lib/ai/knowledgeSearch.ts** (and **lib/ai/officialSapKnowledge.ts** for official SAP wrapper).

### 4.4 Document chunking

- **lib/knowledge/ingestHelpers.ts** — shared chunking + embedding + insert into `knowledge_documents`.  
- **lib/knowledge/curatedSapIngest.ts** — curated SAP ingest (chunk + embed).  
- **scripts/ingestKnowledge.ts**, **scripts/sap-doc-ingestion/importSapDocs.ts** — batch ingest with chunking.  
- Sync routes chunk and embed when processing files.

---

## 5. Types of Assistants

### A) Global assistant (workspace level)

- **Entry:** **GlobalAssistantBubble** in main layout (`app/(private)/layout.tsx`).  
- **Request:** `mode: "global"`, no `projectId`.  
- **Context:** `resolveGlobalContext`: platform summary (from **get_platform_metrics**), or notes insights when `notesVariant`; optional weekly focus; retrieval = official SAP + multi-tenant **global** only (`searchMultiTenantKnowledge(null, null, query)`).  
- **Project-by-name:** If the user asks about a project by name (e.g. “Resumen del proyecto Sauleda”), the route resolves project by name (`resolveProjectByName`), then injects that project’s metrics summary into context; no other project data.

### B) Project assistant (project-specific context)

- **Entry:** **ProjectAssistantDock** inside `app/(private)/projects/[id]/layout.tsx`; **ProjectAssistantChat** sends `mode: "project"`, `projectId`.  
- **Context:** `resolveProjectContext(projectId, userId, message, sapIntent)`: project summary (metrics or getProjectOverview), optional project health/risk tools, weekly focus (optionally scoped to project), then retrieval order: **project memory** → project/global documents (multitenant with that projectId) → **official SAP**.  
- **Isolation:** Only the request’s `projectId` is passed to all project-scoped RPCs and tools; no cross-project data.

**Context injection:** In both cases the resolver returns `contextText` (and retrieval debug). The API route builds `AgentContext` (including `sapitoContextSummary`, notes, links, stats, mode, sapIntent). **projectAgent.ts** injects this into the prompt template as `sapitoContextBlock`, `projectContext`, and intent-based instructions.

---

## 6. Existing Tools / Functions

Sapito does **not** use LLM tool-calling. “Tools” are server-side functions invoked by the **context resolvers** when the message matches certain intents:

| Function / RPC | Invoked when | Purpose |
|----------------|--------------|---------|
| **get_platform_metrics** (RPC) | Always for platform summary in global mode (when workspace_summary intent). | Platform KPIs (projects_total, projects_active, notes_total, notes_today, tickets_open). |
| **get_project_metrics** (RPC) | Project summary in project mode (when project_status or workspace summary). | Single-project metrics (tasks, tickets, activities, notes count). |
| **getProjectOverview** (sapitoTools) | Fallback when get_project_metrics not used; project mode. | Same kind of summary from direct table queries. |
| **getNotesInsights** | Global mode with notes variant (e.g. notes page). | Aggregates notes: total, top modules, error codes, transactions. |
| **analyze_project_health** (executeSapitoTool) | Project mode when message matches “project health” intent. | Returns health score, status, signals, recommendations. |
| **analyze_project_risk** (executeSapitoTool) | Project mode when message matches “project risk” intent. | Returns risk level, summary, signals, recommendations. |
| **analyzeWeeklyFocus** | weekly_focus intent (global or project). | Priorities and recommended actions. |
| **searchProjectMemory** | Project mode retrieval. | Semantic search over project_knowledge_memory. |
| **searchMultiTenantKnowledge** | Global and project retrieval. | Semantic search over knowledge_documents (scope by project/user/global). |
| **getOfficialSapKnowledgeContext** | Global and project retrieval. | Semantic search over official SAP docs (sap_help/sap_official). |

---

## 7. Current Capabilities

Sapito today can:

- **Global (workspace):**  
  - Answer workspace summary (projects, notes, tickets counts).  
  - Answer notes insights (modules, error codes, transactions).  
  - Weekly focus (priorities, next actions).  
  - Answer by project name (“Resumen del proyecto X”) by resolving project and injecting its metrics.  
  - Answer general SAP questions using official SAP + global knowledge retrieval and model knowledge.
- **Project (per project):**  
  - Project status/summary (tasks, tickets, activities, notes).  
  - Project health (analyze_project_health).  
  - Project risk (analyze_project_risk).  
  - Weekly focus (optionally project-aware).  
  - SAP questions grounded in project memory first, then project/global docs and official SAP.
- **SAP intents:** Structured answers for error, transaction, customizing, process, solution design (format instructions in **projectAgent**).
- **Grounding:** Response can include `groundingLabel` (e.g. “Basado en las métricas actuales del workspace”, “Según la documentación SAP indexada”) and optional `debug` (chunk count, document titles) in development.
- **Conversation log:** Every reply is stored in `conversation_logs` (project_id, user_id, mode, messages).

---

## 8. Missing Pieces (documented but not implemented)

- **Full-text search over knowledge_pages:** RPC **search_knowledge(query text)** exists (e.g. in schema) over `knowledge_pages` (title, summary). Sapito’s current retrieval uses **knowledge_documents** (vector) and **project_knowledge_memory** (vector), not **search_knowledge**. So “search knowledge_pages” is available in DB but not wired into Sapito’s context.
- **Project sources “future sync into Sapito knowledge”:** `project_sources` and comments describe future sync into Sapito; sync routes already push to `knowledge_documents` and can trigger project memory. So the main gap is documentation vs. actual use (sync exists; “future” in comments may mean more source types or UI).
- **Defense-in-depth RLS on knowledge_documents:** Documented as “RLS not enabled by design; isolation by RPC parameters; defense-in-depth RLS may be added in a future phase” — not implemented.
- **Explicit tool-calling loop:** Tools (health, risk, weekly focus) are invoked by intent detection in resolvers, not by the LLM requesting a tool. So there is no “Sapito decides to call a tool” step; only “message matches pattern → resolver calls function”.
- **Global (non-project) memory:** Deliverables mention “Future global memory” as an extension of GlobalContextResolver; not implemented.

---

**End of audit.**
