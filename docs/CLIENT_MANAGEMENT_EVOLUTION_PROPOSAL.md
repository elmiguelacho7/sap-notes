# Client Management Evolution – Technical Proposal

## 1. Business goal

Evolve the current minimal client model (single `name` + `client_id` on projects) into a scalable **account-style** structure so the platform can centralize richer customer context for:

- **Project creation** – better client selection and prefill
- **Reporting** – segment by industry, size, region, tier
- **AI grounding** – sap_relevance_summary, known_pain_points, strategic_notes
- **Reusable knowledge** – link knowledge to accounts; future account intelligence

Design principles: additive schema, preserve `project.client_id`, B2B/SAP consulting–friendly, practical first version.

---

## 2. Current state

- **Table `public.clients`**: `id`, `name` (NOT NULL, UNIQUE), `created_at`, `created_by`.
- **Projects**: `client_id uuid REFERENCES clients(id) ON DELETE SET NULL`.
- **RLS**: SELECT for all authenticated; INSERT/UPDATE/DELETE only for `profiles.app_role = 'superadmin'`.
- **API**: `GET /api/admin/clients` (list), `POST /api/admin/clients` (body: `{ name }`). Both require `manage_clients`.
- **UI**: Admin page has a Clients panel: single “Nombre” field + list; no edit. Project/new and notes/new load clients via Supabase `select("id, name, country, industry")` (today `country`/`industry` do not exist on the table; we add them in this evolution).
- **RBAC**: `manage_clients` granted to superadmin and admin (role_permissions). RLS still checks only superadmin; API allows admin.

---

## 3. Target schema

### 3.1 Extended `public.clients`

All new columns nullable; existing rows unchanged. Keep `name` NOT NULL for backward compatibility (dropdowns, existing code).

| Column | Type | Notes |
|--------|------|--------|
| **Identity** | | |
| `name` | text NOT NULL | Kept; use as display label if `display_name` is null. |
| `legal_name` | text | Official / legal company name. |
| `display_name` | text | Short name for UI (e.g. “Acme”). |
| `tax_id` | text | VAT / tax identifier. |
| **Presence** | | |
| `website` | text | Company website. |
| `linkedin_url` | text | LinkedIn company URL. |
| **Segmentation** | | |
| `industry` | text | e.g. Manufacturing, Retail. |
| `subindustry` | text | Finer segment. |
| `company_size_bucket` | text | e.g. SMB, Mid-Market, Enterprise. |
| `employee_range` | text | e.g. 1-50, 51-200. |
| `annual_revenue_range` | text | e.g. <1M, 1-10M. |
| **Geography & locale** | | |
| `country` | text | ISO or name. |
| `region` | text | Region/state. |
| `preferred_language` | text | e.g. es, en. |
| `timezone` | text | e.g. Europe/Madrid. |
| **Structure** | | |
| `parent_client_id` | uuid REFERENCES clients(id) | For group/subsidiary. |
| `account_group` | text | Internal grouping. |
| `account_tier` | text | e.g. Strategic, Standard. |
| `ownership_type` | text | e.g. Public, Private. |
| **Business context** | | |
| `business_model` | text | B2B, B2C, etc. |
| `main_products_services` | text | Free text. |
| **SAP context** | | |
| `sap_relevance_summary` | text | How SAP is used / relevant. |
| **Strategic** | | |
| `known_pain_points` | text | Known challenges. |
| `strategic_notes` | text | Internal notes. |
| **Lifecycle** | | |
| `is_active` | boolean | Default true. |
| `updated_at` | timestamptz | Default now(), set on update. |
| `updated_by` | uuid | Set on update. |

`created_at`, `created_by` already exist.

### 3.2 New table: `public.client_contacts`

Stakeholders / contacts per client.

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid | PK, default gen_random_uuid(). |
| `client_id` | uuid NOT NULL | REFERENCES clients(id) ON DELETE CASCADE. |
| `full_name` | text | |
| `email` | text | |
| `phone` | text | |
| `role_title` | text | Job title. |
| `is_primary` | boolean | Default false. One primary per client recommended. |
| `notes` | text | |
| `created_at` | timestamptz | Default now(). |
| `updated_at` | timestamptz | Default now(). |
| `created_by` | uuid | |

RLS: same as clients (SELECT authenticated; INSERT/UPDATE/DELETE for users with `manage_clients` when we move to permission-based RLS).

### 3.3 New table: `public.client_systems`

SAP / system landscape per client (e.g. S/4HANA Cloud, ECC).

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid | PK. |
| `client_id` | uuid NOT NULL | REFERENCES clients(id) ON DELETE CASCADE. |
| `system_type` | text | e.g. S/4HANA Cloud, S/4HANA On-Premise, ECC. |
| `description` | text | Optional. |
| `is_active` | boolean | Default true. |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `created_by` | uuid | |

RLS: same pattern as clients.

---

## 4. Form field proposal (admin client create/edit)

Sections for UX; first version can show a subset to avoid overwhelming users.

1. **Identity** – legal_name, display_name, name (required), tax_id, website, linkedin_url.
2. **Segmentation** – industry, subindustry, company_size_bucket, employee_range, annual_revenue_range.
3. **Structure** – country, region, parent_client_id (dropdown), account_group, account_tier, ownership_type, business_model, main_products_services.
4. **SAP context** – sap_relevance_summary; optional link to client_systems (list + add).
5. **Stakeholders** – client_contacts list (full_name, email, role_title, is_primary) with add/remove.
6. **Strategic notes** – known_pain_points, strategic_notes.
7. **Lifecycle** – is_active.

First implementation: identity + segmentation + structure + SAP context + strategic notes in one form; stakeholders and systems as optional subsections or follow-up phase.

---

## 5. API changes

- **GET /api/admin/clients**  
  - Continue to require `manage_clients`.  
  - Return extended client fields (all new columns).  
  - Optional `?fields=id,name,display_name,country,industry` for list/dropdowns.

- **POST /api/admin/clients**  
  - Body: extended payload (identity, segmentation, structure, SAP, strategic, is_active).  
  - Still require `name` (or derive from display_name/legal_name).  
  - Set `created_by`, `updated_by`; set `updated_at` = now().

- **GET /api/admin/clients/[id]**  
  - Require `manage_clients` (or later `view_clients` for read-only).  
  - Return one client with all fields; optionally embed client_contacts and client_systems.

- **PATCH /api/admin/clients/[id]**  
  - Require `manage_clients`.  
  - Partial update of allowed fields; set `updated_by`, `updated_at`.

- **Client contacts** (optional in phase 1):  
  - GET/POST/PATCH/DELETE `/api/admin/clients/[id]/contacts` or nested in PATCH client.

- **Client systems** (optional in phase 1):  
  - GET/POST/PATCH/DELETE `/api/admin/clients/[id]/systems` or nested.

Consultants/viewers: today they read clients via Supabase SELECT in project and note flows. For admin UI we keep list/create/edit behind `manage_clients`. Optional: add `view_clients` and a read-only GET /api/clients for dropdowns if we centralize all client reads in API later.

---

## 6. Page/component changes

- **Admin Clients panel** (`app/(private)/admin/page.tsx` or dedicated clients page):  
  - Replace single-name create form with a multi-section form (identity, segmentation, structure, SAP context, strategic notes).  
  - List: show key columns (e.g. display_name or name, country, industry, account_tier); link to edit.  
  - Add client detail/edit route: e.g. `app/(private)/admin/clients/[id]/page.tsx` for PATCH and optional contacts/systems.

- **Project creation** (`app/(private)/projects/new/page.tsx`):  
  - Keep client_id dropdown; ensure select uses `id, name, display_name, country, industry` (or name only) so it works with extended schema.  
  - No change to project.client_id relation.

- **Notes** (`app/(private)/notes/new/page.tsx` and any client selector):  
  - Same as above; use existing or new client fields for display.

- **Reporting / AI** (future):  
  - Use new fields for filters (industry, region, account_tier) and for AI context (sap_relevance_summary, known_pain_points, strategic_notes).

---

## 7. RBAC expectations

| Role | Clients |
|------|--------|
| **superadmin** | Full: create, edit, delete, list. |
| **admin** | Create, edit, list (no delete if we restrict delete to superadmin later). |
| **consultant** | Read/select only (e.g. for project/note dropdowns). |
| **viewer** | Read-only. |

Today: RLS INSERT/UPDATE/DELETE use `app_role = 'superadmin'` only; API uses `manage_clients` (superadmin + admin). Recommendation: migrate RLS to a permission check (e.g. `has_global_permission(auth.uid(), 'manage_clients')`) so admin can write; optionally add `view_clients` for read-only API access. First phase can keep RLS as-is and only extend API and UI; a follow-up migration can switch RLS to permission-based.

---

## 8. How this supports AI, reporting, account intelligence

- **AI grounding**: Use `sap_relevance_summary`, `known_pain_points`, `strategic_notes`, and optionally `main_products_services` when building project or account context for the assistant.
- **Reporting**: Filter/group by `industry`, `region`, `account_tier`, `company_size_bucket`, `country`.
- **Account intelligence**: Use `client_contacts` (roles, primary), `client_systems` (landscape), and `parent_client_id` for hierarchy; combine with project and note data for account-level views later.

---

## 9. Migration plan (additive, safe)

1. **Migration 1** – Extend `clients`: add all new columns (nullable); add `updated_at`/`updated_by`; trigger or application-set `updated_at` on update. Do not drop `name` or `client_id` on projects.
2. **Migration 2** – Create `client_contacts` and `client_systems` with FKs and RLS (SELECT for authenticated; INSERT/UPDATE/DELETE for same policy as clients).
3. **Optional** – RLS update to use `manage_clients` permission instead of `app_role = 'superadmin'` so admin can write.

No removal of existing columns; no change to `projects.client_id`. First phase implements Migration 1 + API + form (identity, segmentation, structure, SAP, strategic) and list + edit; contacts/systems tables in Migration 2 with minimal UI (list/add) or in a later phase.

---

## 10. Phase 1 implementation (done)

- **Migration** `20260408120000_client_management_evolution.sql`: extended `clients` columns, `client_contacts`, `client_systems`, clients RLS updated so admin can write, trigger `updated_at`.
- **API** `GET/POST /api/admin/clients` and `GET/PATCH /api/admin/clients/[id]` with full payload; list and single client return extended fields.
- **Admin UI** ClientsPanel: form with Identity, Segmentación, Estructura (incl. Cliente padre), Contexto SAP, Notas estratégicas, Activo; list with Nombre, País, Industria, Tier; click row to edit, "Nuevo cliente" to create.
- **Project/notes** `projects/new` and `notes/new` select `display_name` and show `display_name || name` in client dropdown; `country` and `industry` used where applicable.
