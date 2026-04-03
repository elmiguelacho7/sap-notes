# Sapito 2.0 — Functional QA test script

**Language:** English (primary).  
**Resumen (ES):** Guía estructurada para validar Sapito en modo global y proyecto: conocimiento SAP, troubleshooting, memoria/documentación de proyecto, documentos conectados, calibración de confianza y honestidad ante evidencia débil.

**Scope:** Manual / exploratory QA aligned with Sapito 2.0 grounding, confidence calibration (Phases 7–8), and UI affordances (chips, follow-ups).  
**Not in scope:** Automated API contract tests (see optional `sapito-test-cases.json` for seeds).

---

## How to use this script

1. Run each case in the **specified mode** (open a project for **project** cases; use workspace without project context or global entry points for **global** cases, per your product UX).
2. Record **pass / fail / blocked** and short notes.
3. Compare outcomes to **expected confidence**, **grounding**, and **honesty** columns. Exact wording may vary; judge by **validation criteria** and guideline rules below.

---

## Expected behavior guidelines

### A) Confidence rules

| Level | Expectation |
|--------|-------------|
| **High** | Strong, aligned evidence (e.g. clear official/curated match for general SAP; strong project memory or tightly aligned project docs for project mode). |
| **Medium** | Partial but useful evidence; related but not fully specific; or connected docs with **partial** topic overlap (per calibration). |
| **Low** | Weak, generic, or missing evidence; strict project questions without solid project anchors; SAP troubleshooting without clear message support in sources. |

### B) Project truthfulness rules

- Generic SAP or platform material must **not** be presented as proof of **what happened in this project** or that **project-specific documentation exists** when it does not.
- If project evidence is missing, the answer should **state that clearly** and distinguish general SAP knowledge from project records.

### C) Connected-document rules

- Connected docs count as **strong** only when **clearly aligned** with the question topic (high topic overlap in retrieval/calibration).
- If material is **loosely related**, Sapito should **say so** and avoid **high** confidence for connected-summary questions.

### D) SAP troubleshooting rules

- Avoid **single definitive diagnoses** when indexed evidence for the **exact message** is weak or absent.
- Prefer cautious wording and verification steps (e.g. SE91, SAP Help) when source support is thin.

### E) Follow-ups / actions

- **Source** and **confidence** chips (or equivalent) should reflect API/meta grounding labels.
- Suggested **follow-ups** and **action chips** should be **relevant** to intent and topic, not generic noise.

---

## Test case template (fields)

For each case below:

| Field | Description |
|--------|-------------|
| **ID** | Stable case ID |
| **Category** | Test area |
| **Prompt** | User message |
| **Mode** | `global` or `project` |
| **Preconditions** | Workspace / project / indexed content assumptions |
| **Expected answer behavior** | Honesty, structure, no overclaim |
| **Expected confidence** | `low` / `medium` / `high` or a allowed range |
| **Expected grounding / sources** | Scopes or summary themes to check |
| **Expected follow-ups / actions** | Chips / suggestions sanity check |
| **Validation criteria** | Pass/fail checks |

---

## 1) Global SAP general knowledge

### SAPITO-GLOBAL-001

| Field | Content |
|--------|---------|
| **ID** | SAPITO-GLOBAL-001 |
| **Category** | Global SAP general knowledge |
| **Prompt** | Do you know SAP Public Cloud? |
| **Mode** | global |
| **Preconditions** | User authenticated; optional indexed SAP/public cloud material. |
| **Expected answer behavior** | Accurate, helpful overview; if no indexed docs, may lean on general knowledge with appropriate caveat. |
| **Expected confidence** | medium to high if strong docs match; low if no retrieval and answer is clearly general. |
| **Expected grounding / sources** | May include `official_sap`, `global_knowledge`, or similar when retrieval runs. |
| **Expected follow-ups / actions** | Suggestions related to cloud, activation, or exploration—not off-topic. |
| **Validation criteria** | No fabricated citations; confidence matches evidence strength. |

### SAPITO-GLOBAL-002

| Field | Content |
|--------|---------|
| **ID** | SAPITO-GLOBAL-002 |
| **Category** | Global SAP general knowledge |
| **Prompt** | How does ATP work in SAP Public Cloud? |
| **Mode** | global |
| **Preconditions** | As above. |
| **Expected answer behavior** | Process explanation; scope boundaries if product-specific. |
| **Expected confidence** | Aligns with doc match quality (often medium–high with good knowledge base). |
| **Expected grounding / sources** | SAP / platform knowledge scopes when present. |
| **Expected follow-ups / actions** | ATP, supply chain, or configuration exploration. |
| **Validation criteria** | Structured answer; no false certainty on tenant-specific config. |

### SAPITO-GLOBAL-003

| Field | Content |
|--------|---------|
| **ID** | SAPITO-GLOBAL-003 |
| **Category** | Global SAP general knowledge |
| **Prompt** | Explain intercompany billing in SAP. |
| **Mode** | global |
| **Preconditions** | As above. |
| **Expected answer behavior** | Clear explanation; notes customizing variance. |
| **Expected confidence** | medium–high with solid retrieval; otherwise lower with caveat. |
| **Expected grounding / sources** | FI / cross-company topics in sources when indexed. |
| **Expected follow-ups / actions** | Related process or config suggestions. |
| **Validation criteria** | Does not claim org-specific setup without evidence. |

### SAPITO-GLOBAL-004

| Field | Content |
|--------|---------|
| **ID** | SAPITO-GLOBAL-004 |
| **Category** | Global SAP general knowledge |
| **Prompt** | What are common integration patterns between SAP S/4HANA and external WMS? |
| **Mode** | global |
| **Preconditions** | As above. |
| **Expected answer behavior** | Patterns and options; cautious on “the only way.” |
| **Expected confidence** | medium typical; high only with strong doc alignment. |
| **Expected grounding / sources** | Architecture / integration docs if present. |
| **Expected follow-ups / actions** | IDoc, API, CPI, or BTP angles if relevant. |
| **Validation criteria** | No single false “standard” when evidence is thin. |

---

## 2) Global SAP troubleshooting

### SAPITO-GLOBAL-010

| Field | Content |
|--------|---------|
| **ID** | SAPITO-GLOBAL-010 |
| **Category** | Global SAP troubleshooting |
| **Prompt** | What does SAP error M7170 mean? |
| **Mode** | global |
| **Preconditions** | Indexed help may or may not contain M7170. |
| **Expected answer behavior** | If weak/absent exact match: **cautious** wording; verify in SAP (e.g. SE91); avoid one certain root cause. |
| **Expected confidence** | **low** or **medium** without exact authoritative match; **high** only with clear message documentation in context. |
| **Expected grounding / sources** | Prefer `official_sap` / curated when message appears in chunk text. |
| **Expected follow-ups / actions** | Verification steps, not only “fix” shortcuts. |
| **Validation criteria** | No overconfident single-path fix when evidence is weak. |

### SAPITO-GLOBAL-011

| Field | Content |
|--------|---------|
| **ID** | SAPITO-GLOBAL-011 |
| **Category** | Global SAP troubleshooting |
| **Prompt** | What should I check for an IDoc posting issue? |
| **Mode** | global |
| **Preconditions** | None specific. |
| **Expected answer behavior** | Checklist-style; multiple possibilities; no false certainty. |
| **Expected confidence** | medium typical unless docs are very specific. |
| **Expected grounding / sources** | IDoc / EDI / WE* / BD* themes if retrieved. |
| **Expected follow-ups / actions** | SM58, WE02, partner profile, etc., as appropriate. |
| **Validation criteria** | Troubleshooting structure; caveats where generic. |

### SAPITO-GLOBAL-012

| Field | Content |
|--------|---------|
| **ID** | SAPITO-GLOBAL-012 |
| **Category** | Global SAP troubleshooting |
| **Prompt** | Explain SAP message M7170 related to batch and vendor. |
| **Mode** | global |
| **Preconditions** | Same as SAPITO-GLOBAL-010; topic adds batch/vendor alignment. |
| **Expected answer behavior** | Tie explanation to **batch/vendor** context when evidence supports it; otherwise cautious. |
| **Expected confidence** | Tied to whether message + topic appear in sources; avoid **high** on guesswork. |
| **Expected grounding / sources** | Chunks mentioning code + relevant modules. |
| **Expected follow-ups / actions** | Relevant master data / procurement checks. |
| **Validation criteria** | Stronger caution if code not in indexed passages. |

### SAPITO-GLOBAL-013

| Field | Content |
|--------|---------|
| **ID** | SAPITO-GLOBAL-013 |
| **Category** | Global SAP troubleshooting |
| **Prompt** | I get a short dump in ST22 when running transaction VF01. What should I do first? |
| **Mode** | global |
| **Preconditions** | None. |
| **Expected answer behavior** | Safe first steps (ST22 analysis, notes, reproducibility); not a invented dump cause. |
| **Expected confidence** | low–medium unless specific dump text/context in evidence. |
| **Expected grounding / sources** | SD / billing if aligned. |
| **Expected follow-ups / actions** | Collect dump details, OSS, test in sandbox. |
| **Validation criteria** | No fabricated dump interpretation. |

---

## 3) Project memory / history

### SAPITO-PROJ-020

| Field | Content |
|--------|---------|
| **ID** | SAPITO-PROJ-020 |
| **Category** | Project memory / history |
| **Prompt** | How did we solve pricing in this project? |
| **Mode** | project |
| **Preconditions** | Project open; **no** indexed project memory/notes proving pricing solution (negative path). |
| **Expected answer behavior** | Honest: no documented solution found; suggests where to document; **no** fake project history. |
| **Expected confidence** | **low** (no strong memory, no strong project docs, no strong connected alignment). |
| **Expected grounding / sources** | No false `project_memory` as proof; generic SAP must not confirm project outcome. |
| **Expected follow-ups / actions** | Document decision, check notes/tickets. |
| **Validation criteria** | Matches micro-calibration: no medium/high without solid anchors. |

### SAPITO-PROJ-021

| Field | Content |
|--------|---------|
| **ID** | SAPITO-PROJ-021 |
| **Category** | Project memory / history |
| **Prompt** | What decisions have we made about pricing? |
| **Mode** | project |
| **Preconditions** | Vary: with/without relevant memory—run both paths. |
| **Expected answer behavior** | With evidence: grounded summary; without: clear absence statement. |
| **Expected confidence** | Scales with evidence (low when absent). |
| **Expected grounding / sources** | `project_memory`, project docs when present. |
| **Expected follow-ups / actions** | Capture decisions in knowledge if missing. |
| **Validation criteria** | Project truthfulness rules respected. |

### SAPITO-PROJ-022

| Field | Content |
|--------|---------|
| **ID** | SAPITO-PROJ-022 |
| **Category** | Project memory / history |
| **Prompt** | What problems have we solved in this project? |
| **Mode** | project |
| **Preconditions** | As available in workspace. |
| **Expected answer behavior** | Lists only what evidence supports. |
| **Expected confidence** | low–medium without rich memory; higher only with strong extracted memory. |
| **Expected grounding / sources** | Memory / notes scopes. |
| **Expected follow-ups / actions** | Link to tickets, notes, documentation. |
| **Validation criteria** | Guardrails: may short-circuit when no strong history evidence (product-specific). |

### SAPITO-PROJ-023

| Field | Content |
|--------|---------|
| **ID** | SAPITO-PROJ-023 |
| **Category** | Project memory / history |
| **Prompt** | Summarize risks we already mitigated last quarter in this project. |
| **Mode** | project |
| **Preconditions** | Prefer project with sparse Q4 data to test honesty. |
| **Expected answer behavior** | Does not invent mitigations; states gaps if any. |
| **Expected confidence** | low if no evidence. |
| **Expected grounding / sources** | Project intelligence / notes only if present. |
| **Expected follow-ups / actions** | Risk register, retrospective. |
| **Validation criteria** | No hallucinated timelines. |

---

## 4) Project documentation

### SAPITO-PROJ-030

| Field | Content |
|--------|---------|
| **ID** | SAPITO-PROJ-030 |
| **Category** | Project documentation |
| **Prompt** | Do we have documentation for this topic? |
| **Mode** | project |
| **Preconditions** | Optional mix of generic SAP index vs project docs. |
| **Expected answer behavior** | Separates **project-specific** docs from **generic SAP** material; does not claim project docs exist on SAP books alone. |
| **Expected confidence** | **low** when only generic SAP; higher only with aligned project docs. |
| **Expected grounding / sources** | `project_documents`, `connected_documents_project` vs `official_sap`. |
| **Expected follow-ups / actions** | Upload/sync project docs, link sources. |
| **Validation criteria** | Documentation precision rules (Phase 8). |

### SAPITO-PROJ-031

| Field | Content |
|--------|---------|
| **ID** | SAPITO-PROJ-031 |
| **Category** | Project documentation |
| **Prompt** | Do we have project-specific documentation for pricing? |
| **Mode** | project |
| **Preconditions** | As above. |
| **Expected answer behavior** | Explicit about pricing-specific project artifacts vs related SAP content. |
| **Expected confidence** | Tied to overlap/retrieval quality. |
| **Expected grounding / sources** | Project-scoped chunks for confirmation. |
| **Expected follow-ups / actions** | Add pricing spec to knowledge. |
| **Validation criteria** | No conflation of generic SD pricing help with “our project doc.” |

### SAPITO-PROJ-032

| Field | Content |
|--------|---------|
| **ID** | SAPITO-PROJ-032 |
| **Category** | Project documentation |
| **Prompt** | Show related project documentation. |
| **Mode** | project |
| **Preconditions** | Project with some indexed docs. |
| **Expected answer behavior** | Lists or summarizes what is indexed; clarifies limits. |
| **Expected confidence** | medium when partial alignment; low if thin. |
| **Expected grounding / sources** | Project / user scope preferred over global. |
| **Expected follow-ups / actions** | Open knowledge, sync sources. |
| **Validation criteria** | Sources cited align with retrieval scopes. |

### SAPITO-PROJ-033

| Field | Content |
|--------|---------|
| **ID** | SAPITO-PROJ-033 |
| **Category** | Project documentation |
| **Prompt** | Where is our technical design document for integrations stored? |
| **Mode** | project |
| **Preconditions** | Known link or unknown—run both. |
| **Expected answer behavior** | If unknown: says so; if in connected/indexed: points appropriately. |
| **Expected confidence** | Matches evidence. |
| **Expected grounding / sources** | Connected + project docs. |
| **Expected follow-ups / actions** | Add link, connect Drive. |
| **Validation criteria** | No invented file paths. |

---

## 5) Connected documents

### SAPITO-PROJ-040

| Field | Content |
|--------|---------|
| **ID** | SAPITO-PROJ-040 |
| **Category** | Connected documents |
| **Prompt** | What do the connected docs say? |
| **Mode** | project |
| **Preconditions** | Connected sources indexed; topic may be misaligned (e.g. pricing question vs DMS docs). |
| **Expected answer behavior** | If misaligned: states weak alignment; does not summarize as direct answer to unrelated topic. |
| **Expected confidence** | **low** without partial overlap on connected chunks; **medium** max with strong overlap; **not high** for this prompt archetype. |
| **Expected grounding / sources** | `connected_documents` / `connected_documents_project`. |
| **Expected follow-ups / actions** | Narrow question, sync relevant files. |
| **Validation criteria** | Micro-calibration for connected-summary questions. |

### SAPITO-PROJ-041

| Field | Content |
|--------|---------|
| **ID** | SAPITO-PROJ-041 |
| **Category** | Connected documents |
| **Prompt** | Summarize the connected docs for pricing. |
| **Mode** | project |
| **Preconditions** | Connected files may or may not mention pricing. |
| **Expected answer behavior** | Only pricing-relevant content; otherwise honest “not found in connected docs.” |
| **Expected confidence** | low–medium per overlap. |
| **Expected grounding / sources** | Connected chunks with topic overlap. |
| **Expected follow-ups / actions** | Upload pricing deck, tag docs. |
| **Validation criteria** | Topic anchoring; no drift into unrelated doc themes. |

### SAPITO-PROJ-042

| Field | Content |
|--------|---------|
| **ID** | SAPITO-PROJ-042 |
| **Category** | Connected documents |
| **Prompt** | Show related connected docs. |
| **Mode** | project |
| **Preconditions** | At least one connected doc. |
| **Expected answer behavior** | Surfaces what retrieval returns; explains relevance level. |
| **Expected confidence** | medium at best when loosely related; low when weak. |
| **Expected grounding / sources** | Connected scopes. |
| **Expected follow-ups / actions** | Refine query, browse knowledge. |
| **Validation criteria** | Confidence not inflated by unrelated project memory alone. |

### SAPITO-PROJ-043

| Field | Content |
|--------|---------|
| **ID** | SAPITO-PROJ-043 |
| **Category** | Connected documents |
| **Prompt** | Search our Google Drive for anything about workflow approval. |
| **Mode** | project |
| **Preconditions** | Drive connected (if product supports explicit connected search). |
| **Expected answer behavior** | Grounded in retrieved connected content or clear “nothing found.” |
| **Expected confidence** | Tied to hits. |
| **Expected grounding / sources** | Connected. |
| **Expected follow-ups / actions** | Narrow search, folder hints. |
| **Validation criteria** | No invented filenames. |

---

## 6) Weak evidence / honesty

### SAPITO-WEAK-050

| Field | Content |
|--------|---------|
| **ID** | SAPITO-WEAK-050 |
| **Category** | Weak evidence / honesty |
| **Prompt** | What exact SAP note fixed our custom Z-program dump in this project? |
| **Mode** | project |
| **Preconditions** | No note captured in project evidence. |
| **Expected answer behavior** | Does not invent note numbers; states lack of record. |
| **Expected confidence** | **low**. |
| **Expected grounding / sources** | No fake citations. |
| **Expected follow-ups / actions** | Document in notes after finding in SAP. |
| **Validation criteria** | Strict honesty. |

### SAPITO-WEAK-051

| Field | Content |
|--------|---------|
| **ID** | SAPITO-WEAK-051 |
| **Category** | Weak evidence / honesty |
| **Prompt** | List every meeting decision we made about scope. |
| **Mode** | project |
| **Preconditions** | No meeting minutes indexed. |
| **Expected answer behavior** | Clear inability to list from evidence; suggests alternatives. |
| **Expected confidence** | **low**. |
| **Expected grounding / sources** | N/A or empty. |
| **Expected follow-ups / actions** | Import minutes, link Confluence. |
| **Validation criteria** | No fabricated meetings. |

### SAPITO-WEAK-052

| Field | Content |
|--------|---------|
| **ID** | SAPITO-WEAK-052 |
| **Category** | Weak evidence / honesty |
| **Prompt** | Confirm that we already went live with module X in production. |
| **Mode** | project |
| **Preconditions** | No go-live record in index. |
| **Expected answer behavior** | Refuses to confirm without evidence; suggests verifying in system of record. |
| **Expected confidence** | **low**. |
| **Expected grounding / sources** | Does not misuse generic SAP text as go-live proof. |
| **Expected follow-ups / actions** | Check cutover checklist, CAB records. |
| **Validation criteria** | Project truthfulness. |

---

## 7) Follow-ups / actions

### SAPITO-UX-060

| Field | Content |
|--------|---------|
| **ID** | SAPITO-UX-060 |
| **Category** | Follow-ups / actions |
| **Prompt** | (Use any SAPITO-GLOBAL or SAPITO-PROJ prompt that returns a full answer.) |
| **Mode** | global or project |
| **Preconditions** | UI shows meta: sources, confidence, suggestions. |
| **Expected answer behavior** | N/A (focus on chrome). |
| **Expected confidence** | Chip matches API/meta level (high/medium/low). |
| **Expected grounding / sources** | Source chips / labels consistent with `retrievalScopes` or summary string themes. |
| **Expected follow-ups / actions** | Next steps **relevant** to intent (e.g. troubleshooting → checks; project doc → sync docs). |
| **Validation criteria** | No regression vs prior release; suggestions not spammy. |

### SAPITO-UX-061

| Field | Content |
|--------|---------|
| **ID** | SAPITO-UX-061 |
| **Category** | Follow-ups / actions |
| **Prompt** | Run a **follow-up** turn: after a pricing answer, ask “What about discounts?” |
| **Mode** | project |
| **Preconditions** | Same session/thread if supported. |
| **Expected answer behavior** | Stays on topic; uses context appropriately. |
| **Expected confidence** | Recalibrated to new sub-question evidence. |
| **Expected grounding / sources** | Updated retrieval if implemented. |
| **Expected follow-ups / actions** | Still relevant to SD/pricing. |
| **Validation criteria** | Conversation coherence; confidence not stuck high from prior turn without evidence. |

### SAPITO-UX-062

| Field | Content |
|--------|---------|
| **ID** | SAPITO-UX-062 |
| **Category** | Follow-ups / actions |
| **Prompt** | After SAPITO-GLOBAL-010, click or use suggested “verify in SE91” style action if offered. |
| **Mode** | global |
| **Preconditions** | Actions feature enabled. |
| **Expected answer behavior** | N/A |
| **Expected confidence** | N/A |
| **Expected grounding / sources** | N/A |
| **Expected follow-ups / actions** | Action payload sensible (no broken deep links if applicable). |
| **Validation criteria** | Smoke test for action chips only. |

---

## Appendix — Reference: retrieval scope labels (indicative)

QA may see scope-like labels in dev logs or meta. Common values include (non-exhaustive):  
`official_sap`, `sap_general_knowledge`, `global_knowledge`, `fulltext_knowledge_pages`, `project_memory`, `project_documents`, `connected_documents`, `connected_documents_project`, `platform_summary`, `project_summary`.

Use these to cross-check **expected grounding** when debugging.

---

## Document control

| Version | Date | Notes |
|---------|------|--------|
| 1.0 | 2026-04 | Initial Sapito 2.0 functional script |
