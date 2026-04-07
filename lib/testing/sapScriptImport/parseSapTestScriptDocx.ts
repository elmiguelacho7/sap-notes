import mammoth from "mammoth";
import { isHeavyNarrativeBlock } from "@/lib/testing/procedurePresentation";
import { normalizeSapImportedScript } from "./normalizeSapImportedScript";
import type { SapImportedActivityDraft, SapImportedStepRow, SapParseResult } from "./types";

function takeAfterLabel(text: string, label: RegExp): string {
  const m = text.match(label);
  if (!m || m.index === undefined) return "";
  const rest = text.slice(m.index + m[0].length).trim();
  const stop = rest.search(/\n\s*(?:[A-Z][a-z]+|Prerequisites|Objective|Business|Test data|Procedure|Summary)/i);
  const chunk = stop > 0 ? rest.slice(0, stop) : rest;
  return chunk.replace(/^[:.\s-]+/, "").trim();
}

function extractRoles(text: string): string[] {
  const roles: string[] = [];
  const block = takeAfterLabel(
    text,
    /(?:business\s*roles?|roles?|test\s*roles?)\s*[:.]?\s*/i
  );
  if (block) {
    for (const part of block.split(/[,;\n•]/)) {
      const t = part.replace(/^[-*]\s*/, "").trim();
      if (t.length > 2 && t.length < 120) roles.push(t);
    }
  }
  const singleLine = text.match(
    /(?:role|actor)\s*[:.]?\s*([^\n]{3,120})/gi
  );
  if (singleLine) {
    for (const ln of singleLine) {
      const v = ln.replace(/^[^:]+:\s*/i, "").trim();
      if (v && !roles.some((r) => r.toLowerCase() === v.toLowerCase())) roles.push(v);
    }
  }
  return roles.slice(0, 20);
}

function extractScopeItem(text: string): string {
  const known = text.match(/\b(\d[A-Z0-9]{2,4})\b/);
  return known ? known[1] : "";
}

/** Skip lines that are clearly setup/reference narrative, not executable actions. */
function shouldSkipNumberedLineAsNarrative(rest: string): boolean {
  const r = rest.trim();
  if (
    /^(purpose|overview|scope|appendix|background|notes?|process\s+integration|succeeding\s+processes|related\s+processes|master\s*data|organizational\s*data|test\s*data|prerequisites?|business\s*conditions?)\s*[:.]/i.test(
      r
    )
  ) {
    return true;
  }
  if (
    r.length > 360 &&
    !/\b(?:open|click|enter|select|save|post|navigate|launch|log\s*on|execute|run|choose|access|display|create|manage|confirm)\b/i.test(
      r
    )
  ) {
    return true;
  }
  return false;
}

/** Numbered or "Step N" lines → procedure steps */
function extractNumberedSteps(text: string): SapImportedStepRow[] {
  const steps: SapImportedStepRow[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const stepLine =
    /^(\d{1,3})[\).\s]+(.+)$|^step\s*(\d{1,3})\s*[:.\s-]+(.+)$/i;
  for (const line of lines) {
    const m = line.match(stepLine);
    if (!m) continue;
    const order = parseInt(m[1] || m[3] || "0", 10);
    const rest = (m[2] || m[4] || "").trim();
    if (!rest || order < 1) continue;
    if (shouldSkipNumberedLineAsNarrative(rest)) continue;
    let instruction = rest;
    let expected: string | null = null;
    const expSplit = rest.split(/\b(?:expected|result)\s*[:]\s*/i);
    if (expSplit.length > 1) {
      instruction = expSplit[0].replace(/[.;-]+\s*$/, "").trim();
      expected = expSplit.slice(1).join(":").trim();
    }
    steps.push({
      step_order: order,
      step_name: instruction.length > 80 ? instruction.slice(0, 77) + "…" : instruction,
      instruction,
      expected_result: expected,
      optional_flag: /\boptional\b/i.test(rest),
    });
  }
  return steps;
}

function extractTableLikeRows(text: string): SapImportedStepRow[] {
  const rows: SapImportedStepRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t.includes("\t") && !/\s{3,}/.test(t)) continue;
    const cells = t.includes("\t")
      ? t.split(/\t/).map((c) => c.trim())
      : t.split(/\s{2,}/).map((c) => c.trim());
    if (cells.length < 2) continue;
    const firstNum = parseInt(cells[0].replace(/\D/g, ""), 10);
    if (!Number.isFinite(firstNum) || firstNum < 1) continue;
    const instruction = cells[1] || cells[0];
    const expected = cells[2] || null;
    const role = cells.find((c, i) => i > 0 && /role/i.test(c)) ?? cells[3] ?? null;
    const tx = cells.find((c) => /\b[A-Z]{2,4}\d{2,4}\b|\/[A-Z]{2,8}\//i.test(c)) ?? null;
    rows.push({
      step_order: firstNum,
      step_name: instruction.length > 60 ? instruction.slice(0, 57) + "…" : instruction,
      instruction,
      expected_result: expected,
      business_role: role && role !== instruction ? role : null,
      transaction_or_app: tx,
    });
  }
  return rows;
}

function extractBusinessConditions(text: string): string {
  return takeAfterLabel(text, /(?:business\s*conditions?)\s*[:.]?\s*/i);
}

/** Split procedure region into activity-like blocks (headings). */
function splitIntoActivitySections(procedureText: string): { title: string; body: string }[] {
  const lines = procedureText.split(/\r?\n/);
  const sections: { title: string; body: string }[] = [];
  let currentTitle = "Procedure";
  const buf: string[] = [];

  const isHeading = (line: string) => {
    const t = line.trim();
    if (t.length < 5 || t.length > 140) return false;
    if (/^activity\s*\d+[\).:\s-]/i.test(t)) return true;
    if (/^(domestic|international|additional)\s*:/i.test(t)) return true;
    if (/^procedure\s*\d+/i.test(t)) return true;
    if (t.length < 80 && t === t.toUpperCase() && /[A-Z]{3,}/.test(t) && !/^\d+$/.test(t)) return true;
    return false;
  };

  const flush = () => {
    sections.push({ title: currentTitle, body: buf.join("\n").trim() });
    buf.length = 0;
  };

  for (const line of lines) {
    if (isHeading(line)) {
      if (buf.some((l) => l.trim()) || sections.length > 0) {
        flush();
      }
      currentTitle = line.trim();
    } else {
      buf.push(line);
    }
  }
  flush();

  const nonEmpty = sections.filter((s) => s.body.trim().length > 0);
  if (nonEmpty.length <= 1) {
    return [{ title: "Procedure", body: procedureText.trim() }];
  }
  return nonEmpty;
}

/** Pull labeled narrative sections out of the execution path into reference notes. */
function extractReferenceNarrativeFromDocx(text: string): string {
  const chunks: string[] = [];
  const re =
    /(?:^|\n)\s*(Purpose|Overview|Scope|Background|Notes?|Appendix|Process\s+Integration|Succeeding\s+Processes|Related\s+processes?)\s*[:.]?\s*\r?\n/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const title = m[1];
    const start = m.index + m[0].length;
    const rest = text.slice(start);
    const nextIdx = rest.search(
      /\n\s*(?:Purpose|Overview|Scope|Background|Notes?|Appendix|Process\s+Integration|Succeeding\s+Processes|Related\s+processes?)\s*[:.]?\s*\r?\n/i
    );
    const body = (nextIdx > 0 ? rest.slice(0, nextIdx) : rest).trim();
    if (body.length > 24) chunks.push(`## ${title}\n${body.slice(0, 8000)}`);
  }
  return chunks.join("\n\n").slice(0, 14000);
}

function trimObjectiveForRunbook(objective: string): { headline: string; overflow: string } {
  const o = objective.replace(/\r\n/g, "\n").trim();
  if (!o) return { headline: "", overflow: "" };
  if (!isHeavyNarrativeBlock(o) && o.length <= 320) return { headline: o, overflow: "" };
  const paras = o.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  let headline = paras[0] ?? o.slice(0, 220);
  let overflow = paras.slice(1).join("\n\n");
  if (headline.length > 260) {
    const restOfFirst = headline.slice(260).trim();
    headline = headline.slice(0, 257).trim() + "…";
    overflow = [restOfFirst, overflow].filter(Boolean).join("\n\n");
  }
  if (!overflow && o.length > 300) {
    headline = o.slice(0, 220).trim() + "…";
    overflow = o.slice(220).trim();
  }
  return { headline, overflow };
}

function pickTitle(text: string, fileName: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const ln of lines.slice(0, 25)) {
    if (/^test\s*(case|script|scenario)/i.test(ln) && ln.length > 12) {
      return ln.replace(/^test\s*(case|script|scenario)\s*[:#.]?\s*/i, "").trim() || ln;
    }
  }
  for (const ln of lines.slice(0, 15)) {
    if (ln.length > 8 && ln.length < 200 && !/^[0-9]+[\).]/.test(ln)) return ln;
  }
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Imported test script";
}

export async function parseSapTestScriptDocx(buffer: Buffer, fileName: string): Promise<SapParseResult> {
  const warnings: string[] = [];
  let raw = "";
  try {
    const result = await mammoth.extractRawText({ buffer });
    raw = (result.value ?? "").replace(/\u00a0/g, " ");
    if (result.messages?.length) {
      for (const m of result.messages.slice(0, 5)) {
        warnings.push(typeof m.message === "string" ? m.message : "DOCX conversion note");
      }
    }
  } catch (e) {
    warnings.push(e instanceof Error ? e.message : "Could not read DOCX");
    return {
      draft: normalizeSapImportedScript(
        { title: fileName, objective: "", reference_notes: "", steps: [], activities: [] },
        { source_import_type: "sap_docx", source_document_name: fileName }
      ),
      warnings,
    };
  }

  if (raw.length < 40) {
    warnings.push("Document text is very short; extraction may be incomplete.");
  }

  const objectiveRaw =
    takeAfterLabel(raw, /(?:objective|purpose|goal|summary)\s*[:.]?\s*/i) ||
    takeAfterLabel(raw, /(?:description)\s*[:.]?\s*/i);
  const { headline: objective, overflow: objectiveOverflow } = trimObjectiveForRunbook(objectiveRaw);
  const referenceFromDoc = extractReferenceNarrativeFromDocx(raw);
  const reference_notes = [referenceFromDoc, objectiveOverflow].filter(Boolean).join("\n\n").trim();
  const preconditions =
    takeAfterLabel(raw, /(?:prerequisites?|pre-conditions?)\s*[:.]?\s*/i) ||
    takeAfterLabel(raw, /(?:precondition)\s*[:.]?\s*/i);
  const testData =
    takeAfterLabel(raw, /(?:master\s*data|organizational\s*data|test\s*data)\s*[:.]?\s*/i);
  const scenario =
    takeAfterLabel(raw, /(?:variant|scenario|branch)\s*[:.]?\s*/i);
  const expectedScript = takeAfterLabel(raw, /(?:overall\s*expected|expected\s*result)\s*[:.]?\s*/i);

  const roles = extractRoles(raw);
  const scope = extractScopeItem(raw);
  const business_conditions = extractBusinessConditions(raw);

  const procMatch = raw.match(/\b(?:test\s*)?procedure\b/i);
  const procedureText =
    procMatch && procMatch.index !== undefined ? raw.slice(procMatch.index) : raw;

  const sections = splitIntoActivitySections(procedureText);
  let activities: SapImportedActivityDraft[] = [];
  if (sections.length > 1) {
    activities = sections.map((sec, idx) => {
      const tab = extractTableLikeRows(sec.body);
      const num = tab.length ? tab : extractNumberedSteps(sec.body);
      return {
        scenario_name: scenario,
        activity_title: sec.title,
        activity_target_name: "",
        activity_target_url: "",
        business_role: "",
        activity_order: idx,
        steps: num,
      };
    });
    const total = activities.reduce((n, a) => n + a.steps.length, 0);
    if (total === 0) activities = [];
  }

  let steps: SapImportedStepRow[] = [];
  if (activities.length === 0) {
    steps = extractTableLikeRows(raw);
    if (steps.length === 0) steps = extractNumberedSteps(raw);
    if (steps.length === 0) {
      warnings.push(
        "No numbered steps or tabular rows detected; add steps manually after import."
      );
    }
  }

  const draft = normalizeSapImportedScript(
    {
      title: pickTitle(raw, fileName),
      objective,
      preconditions,
      test_data: testData,
      business_conditions,
      reference_notes,
      expected_result: expectedScript,
      scenario_path: scenario,
      business_roles: roles,
      scope_item_code: scope,
      activities,
      steps,
      source_language: "",
    },
    { source_import_type: "sap_docx", source_document_name: fileName }
  );

  return { draft, warnings };
}
