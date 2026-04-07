import * as XLSX from "xlsx";
import { SAP_TEST_MODULE_OPTIONS } from "@/lib/testing/sapModuleCatalog";

const TEMPLATE_FILENAME = "Ribbit_Test_Script_Template_v1.xlsx";

function readmeSheet(): XLSX.WorkSheet {
  const rows: string[][] = [
    ["Ribbit Test Script Template v1"],
    [""],
    ["Purpose"],
    [
      "Use this workbook to author a test script with a predictable structure. Import it from Project → Testing → Import structured template.",
    ],
    [""],
    ["Sheets"],
    ["README — This guide (optional for the importer)."],
    ["Script — One script-level row: title, module, setup fields."],
    ["Steps — One row per step; required columns drive scenario → activity → steps."],
    ["Lists — Allowed values for Test Type, Priority, Status, Optional, and Module hints."],
    [""],
    ["Required fields"],
    ["Script: Script Title, Test Type."],
    ["Steps: Scenario, Activity, Step Order, Instruction."],
    [""],
    ["How to fill in"],
    ["Add one data row directly under the header row on the Script sheet (row 2 in Excel)."],
    ["Add step rows directly under the header row on the Steps sheet (one row per step)."],
    [""],
    ["Import behavior"],
    [
      "Rows are grouped by Scenario + Activity. App / Transaction groups steps in the Procedure viewer. Empty rows are skipped. Invalid enums are normalized or warned.",
    ],
  ];
  return XLSX.utils.aoa_to_sheet(rows);
}

function scriptSheet(): XLSX.WorkSheet {
  const headers = [
    "Script Title",
    "Scope Item",
    "Module",
    "Test Type",
    "Priority",
    "Status",
    "Objective",
    "Preconditions",
    "Business Conditions",
    "Test Data",
    "Business Roles",
    "Source System",
    "Reference Notes",
  ];
  return XLSX.utils.aoa_to_sheet([headers]);
}

function stepsSheet(): XLSX.WorkSheet {
  const headers = [
    "Scenario",
    "Activity",
    "App / Transaction",
    "Step Order",
    "Action",
    "Instruction",
    "Expected Result",
    "Input / Data",
    "Role",
    "Optional",
    "Notes",
  ];
  return XLSX.utils.aoa_to_sheet([headers]);
}

function listsSheet(): XLSX.WorkSheet {
  const testTypes = ["UAT", "SIT", "Regression"];
  const priorities = ["Low", "Medium", "High", "Critical"];
  const statuses = ["Draft", "Ready", "Archived"];
  const optional = ["Yes", "No"];
  const modules = [
    "SD",
    "MM",
    "FI",
    "CO",
    "PP",
    "WM",
    "EWM",
    "QM",
    "PM",
    "TM",
    "BTP",
    "SAC",
    "Other",
    "",
    "Also allowed: full labels from the app (e.g. SD — Sales & Distribution).",
  ];
  const maxR = Math.max(
    testTypes.length,
    priorities.length,
    statuses.length,
    optional.length,
    modules.length,
    SAP_TEST_MODULE_OPTIONS.length
  );
  const rows: string[][] = [
    ["Test Type", "Priority", "Status", "Optional", "Module (hint)"],
  ];
  for (let i = 0; i < maxR; i++) {
    rows.push([
      testTypes[i] ?? "",
      priorities[i] ?? "",
      statuses[i] ?? "",
      optional[i] ?? "",
      modules[i] ?? "",
    ]);
  }
  const extra = SAP_TEST_MODULE_OPTIONS.filter((o) => o.value !== "").map((o) => o.label);
  rows.push([""]);
  rows.push(["Module codes (app catalog)"]);
  for (const line of extra) {
    rows.push(["", "", "", "", line]);
  }
  return XLSX.utils.aoa_to_sheet(rows);
}

/** Official Ribbit structured test script template (.xlsx). */
export function buildRibbitTemplateXlsxBuffer(): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, readmeSheet(), "README");
  XLSX.utils.book_append_sheet(wb, scriptSheet(), "Script");
  XLSX.utils.book_append_sheet(wb, stepsSheet(), "Steps");
  XLSX.utils.book_append_sheet(wb, listsSheet(), "Lists");
  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer);
}

export const RIBBIT_TEMPLATE_DOWNLOAD_NAME = TEMPLATE_FILENAME;
