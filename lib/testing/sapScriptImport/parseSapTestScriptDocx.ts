import mammoth from "mammoth";
import { normalizeSapImportedScript } from "./normalizeSapImportedScript";
import type { SapImportedStepRow, SapParseResult } from "./types";

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
        { title: fileName, objective: "", steps: [] },
        { source_import_type: "sap_docx", source_document_name: fileName }
      ),
      warnings,
    };
  }

  if (raw.length < 40) {
    warnings.push("Document text is very short; extraction may be incomplete.");
  }

  const objective =
    takeAfterLabel(raw, /(?:objective|purpose|goal|summary)\s*[:.]?\s*/i) ||
    takeAfterLabel(raw, /(?:description)\s*[:.]?\s*/i);
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
  let steps = extractTableLikeRows(raw);
  if (steps.length === 0) steps = extractNumberedSteps(raw);
  if (steps.length === 0) {
    warnings.push(
      "No numbered steps or tabular rows detected; add steps manually after import."
    );
  }

  const draft = normalizeSapImportedScript(
    {
      title: pickTitle(raw, fileName),
      objective,
      preconditions,
      test_data: testData,
      expected_result: expectedScript,
      scenario_path: scenario,
      business_roles: roles,
      scope_item_code: scope,
      steps,
      source_language: "",
    },
    { source_import_type: "sap_docx", source_document_name: fileName }
  );

  return { draft, warnings };
}
