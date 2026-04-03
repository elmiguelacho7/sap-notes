# Sapito 2.0 — Release checklist

Use this list before merging or releasing changes that touch Sapito (Brain / project agent, retrieval, grounding, intents, UI chips).

## Automated gates

- [ ] `npm run build` completes successfully
- [ ] `npx tsc --noEmit` completes successfully
- [ ] No new linter errors in touched Sapito paths (optional but recommended)

## Functional spot-checks (manual)

- [ ] **Global SAP (general)** — At least one prompt from category 1 in `sapito-functional-test-script.md` behaves sensibly; confidence matches evidence
- [ ] **Global SAP (troubleshooting)** — At least one error/message-style prompt; no overconfident single fix when sources lack the exact message
- [ ] **Project memory / history** — “How did we solve X in this project?” with **no** evidence → honest answer, **low** confidence
- [ ] **Project documentation** — “Do we have documentation for this topic?” distinguishes project-specific vs generic SAP material
- [ ] **Connected documents** — “What do the connected docs say?” does not show **high** confidence when alignment is weak; answer states misalignment if applicable
- [ ] **Weak evidence / honesty** — One deliberately unanswerable project question does not produce fabricated facts or note numbers

## UX / meta

- [ ] **Confidence chip** (or equivalent) aligns with API/meta for sampled cases
- [ ] **Source / grounding summary** readable and consistent with strict project vs global behavior
- [ ] **Follow-ups / action suggestions** still relevant (no obvious regression or broken actions)

## Regression awareness

- [ ] Project history **guard** (early honest reply when no strong history evidence) still works if unchanged by PR
- [ ] **Phases 7–8** calibration: no unintended re-inflation of confidence on strict project or connected-summary paths

## Sign-off

| Role | Name | Date |
|------|------|------|
| Tester | | |
| Dev | | |

**Optional:** Attach session notes or link to test run IDs.
