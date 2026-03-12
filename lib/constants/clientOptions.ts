/**
 * UI-level controlled options for client fields.
 * Use for selects to avoid dirty free-text; not master tables.
 */

export const INDUSTRY_OPTIONS = [
  { value: "", label: "—" },
  { value: "Manufacturing", label: "Manufacturing" },
  { value: "Retail", label: "Retail" },
  { value: "Financial Services", label: "Financial Services" },
  { value: "Healthcare", label: "Healthcare" },
  { value: "Energy", label: "Energy" },
  { value: "Public Sector", label: "Public Sector" },
  { value: "Professional Services", label: "Professional Services" },
  { value: "Technology", label: "Technology" },
  { value: "Transportation", label: "Transportation" },
  { value: "Other", label: "Otro" },
];

export const COMPANY_SIZE_OPTIONS = [
  { value: "", label: "—" },
  { value: "SMB", label: "SMB" },
  { value: "Mid-Market", label: "Mid-Market" },
  { value: "Enterprise", label: "Enterprise" },
  { value: "Startup", label: "Startup" },
  { value: "Other", label: "Otro" },
];

export const ACCOUNT_TIER_OPTIONS = [
  { value: "", label: "—" },
  { value: "Strategic", label: "Strategic" },
  { value: "Standard", label: "Standard" },
  { value: "Tactical", label: "Tactical" },
  { value: "Other", label: "Otro" },
];

export const OWNERSHIP_TYPE_OPTIONS = [
  { value: "", label: "—" },
  { value: "Public", label: "Public" },
  { value: "Private", label: "Private" },
  { value: "Non-profit", label: "Non-profit" },
  { value: "Other", label: "Otro" },
];

export const BUSINESS_MODEL_OPTIONS = [
  { value: "", label: "—" },
  { value: "B2B", label: "B2B" },
  { value: "B2C", label: "B2C" },
  { value: "B2B2C", label: "B2B2C" },
  { value: "Other", label: "Otro" },
];
