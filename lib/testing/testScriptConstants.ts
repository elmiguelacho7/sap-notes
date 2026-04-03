export const TEST_SCRIPT_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type TestScriptPriority = (typeof TEST_SCRIPT_PRIORITIES)[number];

export function asTestScriptPriority(v: string | null | undefined): TestScriptPriority | null {
  if (v == null || String(v).trim() === "") return null;
  const s = String(v).toLowerCase().trim();
  return (TEST_SCRIPT_PRIORITIES as readonly string[]).includes(s) ? (s as TestScriptPriority) : null;
}
