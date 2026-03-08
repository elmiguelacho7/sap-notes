# SAP Project Memory — deliverables

## 1. New table

**`project_knowledge_memory`** (migration `20260332000000_project_knowledge_memory.sql`)

| Column       | Type         | Notes                                      |
|-------------|--------------|--------------------------------------------|
| id          | UUID         | PK, default gen_random_uuid()              |
| project_id  | UUID         | NOT NULL, FK → projects(id) ON DELETE CASCADE |
| user_id     | UUID         | FK → profiles(id) ON DELETE SET NULL      |
| title       | TEXT         |                                            |
| problem     | TEXT         |                                            |
| solution    | TEXT         | NOT NULL                                   |
| module      | TEXT         |                                            |
| source_type | TEXT         | NOT NULL (`ticket_closed`, `project_note`, `document_added`) |
| created_at  | TIMESTAMPTZ  | NOT NULL, default now()                    |
| embedding   | VECTOR(1536) | OpenAI text-embedding-3-small               |

Indexes: `(project_id, user_id)` WHERE embedding IS NOT NULL; IVFFlat on `embedding` for similarity search.

RPC: **`search_project_knowledge_memory(p_project_id, p_user_id, query_embedding, match_limit)`** — semantic search filtered by project and user.

---

## 2. Retrieval integration

- **`lib/ai/knowledgeSearch.ts`**: Added `searchProjectMemory(projectId, userId, query, topK)` calling the new RPC; returns `ProjectMemoryChunk[]`.
- **`lib/ai/sapitoContext.ts`**: For scope `project`:
  1. Calls `searchProjectMemory(projectId, userId, query, MAX_MEMORY_ITEMS)`.
  2. Calls `searchMultiTenantKnowledge(projectId, userId, query, topK)`.
  3. Injects **project memory section first** (with grounding instruction), then project/global documents, then official SAP chunks.
- **Ranking order** (PART 4): 1) project memory, 2) project documents, 3) global SAP knowledge, 4) model knowledge (in prompt instruction in `projectAgent.ts`).

---

## 3. Memory extraction logic

- **`lib/ai/projectMemory.ts`**:
  - **`extractKnowledgeFromTicket(title, description)`** → problem (title), solution (description), module from content or "general".
  - **`extractKnowledgeFromNote(title, body, noteModule)`** → problem (title), solution (body), module from note.
  - **`extractKnowledgeFromDocument(documentTitle, content, moduleLabel)`** → problem "Document added: …", solution (content), module.
  - **`storeProjectMemory(projectId, userId, record, sourceType)`** → builds embedding from problem + solution, inserts into `project_knowledge_memory`.

**Event hooks:**

- **Ticket closed** (`app/api/tickets/[id]/route.ts`): On PATCH with `status === "closed"`, fetches ticket (title, description, project_id, assigned_to), extracts knowledge, calls `storeProjectMemory(…, "ticket_closed")` (fire-and-forget).
- **Project note created** (`app/api/projects/[id]/notes/route.ts`): After `createProjectNote`, extracts from payload (title, body, module), calls `storeProjectMemory(…, "project_note")` (fire-and-forget). Uses `getCurrentUserIdFromRequest` when available.
- **Document added** (`app/api/projects/[id]/sources/[sourceId]/sync/route.ts`): After successfully processing each file (chunks inserted), extracts from file title + text + module, calls `storeProjectMemory(…, "document_added")` (fire-and-forget). `userId` passed from sync handler.

---

## 4. Ranking update

- In **`lib/ai/sapitoContext.ts`**: Project memory is fetched and injected **before** multitenant knowledge; section title includes instruction to start with "Based on previous SAP project experience..." when using it.
- In **`lib/langchain/projectAgent.ts`**: `knowledgeInstruction` updated so priority is: 1) project experience (with grounding phrase), 2) documentación SAP recuperada, 3) conocimiento de proyecto, 4) conocimiento del modelo. Explicit instruction: when using "Experiencia previa del proyecto SAP", start the answer with "Based on previous SAP project experience...".

---

## 5. Response grounding (PART 5)

- Context block for project memory in `sapitoContext.ts`:  
  "Experiencia previa del proyecto SAP (usa cuando sea relevante; si usas esta experiencia, empieza la respuesta con: \"Based on previous SAP project experience...\"):"
- Same instruction in `projectAgent.ts` knowledge priority text.

---

## 6. Debug logs (PART 6)

- **`[Sapito memory retrieval]`** with:
  - **memoriesFound**: number of project memory items returned.
  - **projectsUsed**: array of project IDs that contributed memory (e.g. `[projectId]` when `memoriesFound > 0`).

Logged in `lib/ai/sapitoContext.ts` when running project-scoped retrieval.

---

## 7. Deliverables summary

| Deliverable              | Location / description |
|--------------------------|-------------------------|
| New table                | `project_knowledge_memory` + RPC (migration above). |
| Retrieval integration    | `searchProjectMemory` in knowledgeSearch; sapitoContext calls it first and merges with documents. |
| Memory extraction logic  | `projectMemory.ts` (extract + store); wired on ticket closed, note created, document sync. |
| Ranking update           | 1. project memory, 2. project docs, 3. global SAP, 4. model knowledge (sapitoContext + projectAgent). |
