# Sapito multi-tenant knowledge isolation — deliverables

## 1. Modified files

| File | Change |
|------|--------|
| `supabase/migrations/20260331000000_knowledge_documents_scope_multitenant.sql` | **New.** Adds `scope_type`, `user_id` to `knowledge_documents`; backfill; trigger to keep scope in sync; index. |
| `supabase/migrations/20260331000001_search_knowledge_multitenant.sql` | **New.** Defines `search_knowledge_documents_multitenant` RPC. |
| `lib/ai/knowledgeSearch.ts` | Added `scope_type` to `KnowledgeChunk`; added `searchMultiTenantKnowledge()` and `MultiTenantRetrievalResult`. |
| `lib/ai/sapitoContext.ts` | Added `userId` to params; project/global retrieval uses `searchMultiTenantKnowledge`; added `[Sapito multi-tenant retrieval]` logging. |
| `app/api/project-agent/route.ts` | Passes `userId` into `buildSapitoContext` for project scope. |
| `scripts/validate-multitenant-retrieval.ts` | **New.** Validation script: User A on project X cannot see project Y docs; User B on project Y cannot see project X docs; no projectId → only global. |

## 2. Database changes

- **Table `knowledge_documents`:**
  - `scope_type` TEXT — values: `'global'`, `'project'`, `'user'`. Default `'global'`. Backfilled from existing `project_id` (non-null → `'project'`, null → `'global'`).
  - `user_id` UUID REFERENCES `profiles(id)` ON DELETE SET NULL — owner for user-scoped documents.
- **Trigger** `knowledge_documents_scope_sync_trigger`: on INSERT/UPDATE of `project_id`, `user_id`, or `scope_type`, sets `scope_type` from `project_id`/`user_id` when appropriate.
- **Index** `idx_knowledge_documents_scope_type_project_user` on `(scope_type, project_id, user_id)` WHERE `embedding IS NOT NULL`.
- **Function** `search_knowledge_documents_multitenant(p_project_id, p_user_id, query_embedding, match_limit)` — see retrieval logic below.

## 3. Retrieval logic

- **When `projectId` is present:**  
  Retrieve rows where  
  `(scope_type = 'global') OR (scope_type = 'project' AND project_id = projectId) OR (scope_type = 'user' AND user_id = userId)`.
- **When `projectId` is absent:**  
  Retrieve only `scope_type = 'global'`.
- **Ordering (priority):** 1) project, 2) user, 3) global; within each group, by embedding similarity (cosine).
- Implemented in SQL in `search_knowledge_documents_multitenant`; called from `searchMultiTenantKnowledge()` in `knowledgeSearch.ts`; used by `buildSapitoContext()` in `sapitoContext.ts` for both project and global scope.

## 4. Security validation

- **Never return:** `scope_type = 'project'` and `project_id !=` current `projectId` (enforced in RPC `WHERE`).
- **Never return:** another user’s user-scoped docs (only `user_id = p_user_id` when `scope_type = 'user'`).
- **Test scenario:** Run `npx tsx scripts/validate-multitenant-retrieval.ts` (optionally with `PROJECT_ID_X`, `PROJECT_ID_Y`, `USER_ID_A`, `USER_ID_B`). It asserts:
  - User A on project X → no documents belonging to another project.
  - User B on project Y → no documents belonging to another project.
  - No `projectId` → only `scope_type = 'global'` documents.

## 5. Debug logging

Every retrieval logs:

```
[Sapito multi-tenant retrieval] { userId, projectId, documentsRetrieved, scopeBreakdown }
```

`scopeBreakdown` is `{ project, user, global }` counts from the multitenant RPC result.
