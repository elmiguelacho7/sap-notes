# Client management UI and load-error fixes

## 1. "Error al cargar los clientes" – root cause and fix

### Root cause

- **API** `GET /api/admin/clients` used a single `select(...)` listing all extended columns (e.g. `display_name`, `legal_name`, `country`, `industry`, …).
- If the **client evolution migration** (`20260408120000_client_management_evolution.sql`) had not been applied, the Supabase query failed with a **column does not exist** error (e.g. `42703` or message containing "column ... does not exist").
- The API then returned **500** with message "Error al cargar los clientes.", which the Clients page showed as the generic error.

Additional contributing factors:

- **Access**: The dedicated Clients page (`/clients`) only called `loadClients()` when `appRole === "superadmin"`. If the backend expected `manage_clients` and the user was **admin**, they would not see the Clients nav item (sidebar was superadmin-only), so the main scenario for the error was **superadmin with unapplied migration** (500) or **network/DB error**. The page now allows **admin** as well and shows a clear message on 403.

### Fix

- **Resilient GET** in `app/api/admin/clients/route.ts`: try the full extended `select` first; on error, if the error looks like a missing-column error (`42703` or message "column ... does not exist"), retry with a **minimal** select `id, name, created_at, created_by` and return that. The list then loads even when the extended migration is not yet applied.
- **Resilient GET by id** in `app/api/admin/clients/[id]/route.ts`: same fallback for the single-client fetch.
- **Access** for `/clients`: page and sidebar now allow **superadmin** and **admin** (RBAC: both have `manage_clients`). On 403 the page shows "No tiene permiso para gestionar clientes."

### Files involved

- `app/api/admin/clients/route.ts` – GET fallback and `CLIENT_SELECT_MINIMAL`
- `app/api/admin/clients/[id]/route.ts` – GET fallback and `CLIENT_SELECT_MINIMAL`
- `app/(private)/clients/page.tsx` – allow admin, show 403 message, extended UI
- `components/ui/sidebar/Sidebar.tsx` – Clients nav item visible for `["superadmin", "admin"]`

### Confirmation

After the fix:

- If the migration is applied: full client list with extended fields loads.
- If the migration is not applied: client list still loads with minimal fields (id, name, created_at, created_by); create/edit can still work for `name` and the API will accept extended payload (extra columns are ignored by DB until migration exists).

---

## 2. Clients page UI upgrade

- **Sections**: Identity, Segmentación, Geografía, Estructura, Contexto SAP, Notas estratégicas, Lifecycle (is_active), with clear headings.
- **List**: Columns Nombre (display_name || name), País, Industria, Tier, Estado (Activo/Inactivo). Row click loads client into form for edit. Empty, loading, and error states; success message after create/update (auto-dismiss).
- **Controlled options**: Selects for industry, company_size_bucket, account_tier, ownership_type, business_model using `lib/constants/clientOptions.ts` (UI-level constants).
- **Create vs edit**: Title "Nuevo cliente" vs "Editar cliente"; "Cancelar · Crear otro" when editing; "+ Nuevo cliente" in list section.
- **Placeholders for growth**: Tabs "Datos del cliente" | "Contactos" | "Sistemas"; Contactos and Sistemas show placeholder text for future client_contacts / client_systems UI.

### Files changed

- `app/(private)/clients/page.tsx` – rewritten with sections, list, options, tabs, success/error/empty/loading.
- `lib/constants/clientOptions.ts` – new file with option arrays for industry, company_size_bucket, account_tier, ownership_type, business_model.

---

## 3. Project creation – client summary card

- When a client is selected in the project form, a **compact summary card** is shown under the client dropdown with: display_name (or name), country, industry, account_tier, and a short sap_relevance_summary (line-clamp 2).
- Client type and Supabase select in `app/(private)/projects/new/page.tsx` extended with `account_tier` and `sap_relevance_summary`.

### Files changed

- `app/(private)/projects/new/page.tsx` – Client type and select extended; conditional summary card when `clientId` is set.

---

## 4. Hydration warning audit

### Observation

- The reported hydration diff included: **`data-smart-converter-loaded="true"`**.
- This attribute is **not** present in the app codebase. It is a known pattern for **browser extensions** (e.g. unit converters, translation tools) that inject attributes or nodes into the DOM after the server-rendered HTML is sent.

### Conclusion

- The hydration warning is **not** caused by application code. It is almost certainly due to a **browser extension** (or similar) modifying the DOM and causing a server/client HTML mismatch.
- **No code changes** are required in the app for this warning. Optional: document for the team that `data-smart-converter-loaded` is external and can be ignored, or suggest disabling the extension when developing to reduce console noise.

### Checked

- No `typeof window` / `Date.now()` / `Math.random()` in render in client-management pages that would differ between server and client.
- No conditional rendering that depends on client-only state before mount in a way that would change the initial tree.
- No invalid HTML nesting or locale-dependent formatting in the initial render of the clients or project-new pages that would cause a real app-side hydration mismatch.

---

## 5. Quick client creation (project flow)

The "Crear cliente rápido" modal during project creation now includes:

- **Required:** name.
- **Optional:** industry (select from `clientOptions`), country (text), account_tier (select from `clientOptions`).
- **UX:** Title "Crear cliente rápido"; helper text: "Puedes completar más información del cliente más adelante en la sección Clientes."
- **Flow:** On success, the new client is appended to local state (no full reload), the dropdown selection is set to the new client, and the modal is closed.

**Source tracking (proposal only):** The `clients` table does not currently have a `source` or `creation_source` column. To record that a client was created from the quick-create modal (e.g. `source = 'quick_create_project'`) for analytics or UX, a future migration could add a nullable column such as `creation_source text` and set it in `POST /api/admin/clients` when the request includes e.g. `creation_source: 'quick_create_project'`. No schema change was made in this pass.

---

## 6. RBAC

- **Clients**: superadmin and admin can create/edit (RLS and API use `manage_clients`; sidebar and `/clients` page allow both roles). Consultant and viewer have read/select only (e.g. dropdowns); they do not see the Clients nav item and get "Acceso restringido" if they open `/clients` directly.
- **RLS**: Still uses `app_role IN ('superadmin', 'admin')` for clients and related tables; no change in this pass. A future permission-based RLS (e.g. `has_global_permission(auth.uid(), 'manage_clients')`) can be documented and implemented later.
