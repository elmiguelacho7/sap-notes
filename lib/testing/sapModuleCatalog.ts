/**
 * SAP module dropdown for Testing scripts — aligned with lib/ai/sapTaxonomy SapDomain.
 * Single catalog for UI + validation (no separate DB table in v1).
 */
export type SapTestModuleValue =
  | ""
  | "sd"
  | "mm"
  | "fi"
  | "co"
  | "pp"
  | "qm"
  | "wm"
  | "ewm"
  | "tm"
  | "le"
  | "basis"
  | "security"
  | "abap"
  | "btp"
  | "public_cloud"
  | "on_prem"
  | "cross_functional";

export const SAP_TEST_MODULE_OPTIONS: { value: SapTestModuleValue; label: string }[] = [
  { value: "", label: "—" },
  { value: "sd", label: "SD — Sales & Distribution" },
  { value: "mm", label: "MM — Materials Management" },
  { value: "fi", label: "FI — Finance" },
  { value: "co", label: "CO — Controlling" },
  { value: "pp", label: "PP — Production Planning" },
  { value: "qm", label: "QM — Quality Management" },
  { value: "wm", label: "WM — Warehouse Management" },
  { value: "ewm", label: "EWM — Extended WM" },
  { value: "tm", label: "TM — Transportation Management" },
  { value: "le", label: "LE — Logistics Execution" },
  { value: "basis", label: "Basis / Technical" },
  { value: "security", label: "Security / Authorizations" },
  { value: "abap", label: "ABAP / Development" },
  { value: "btp", label: "SAP BTP / Integration" },
  { value: "public_cloud", label: "SAP Public Cloud" },
  { value: "on_prem", label: "S/4HANA / ECC On-premise" },
  { value: "cross_functional", label: "Cross-functional / Multiple" },
];

export function isValidSapTestModule(v: string | null | undefined): v is SapTestModuleValue {
  if (v == null || v === "") return true;
  return SAP_TEST_MODULE_OPTIONS.some((o) => o.value === v && o.value !== "");
}

export function labelForSapTestModule(v: string | null | undefined): string {
  if (v == null || v === "") return "";
  const o = SAP_TEST_MODULE_OPTIONS.find((x) => x.value === v);
  return o?.label ?? v;
}
