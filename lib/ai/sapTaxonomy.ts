/**
 * Phase 5: Lightweight SAP topic / domain taxonomy (deterministic, extensible).
 *
 * This taxonomy is used as a signal for:
 * - routing (intent + response shaping)
 * - retrieval ranking
 * - future source filtering / analytics
 */

export type SapDomain =
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
  | "on_prem";

export type SapTheme =
  | "pricing"
  | "atp"
  | "aatp"
  | "intercompany"
  | "consignment"
  | "billing"
  | "output"
  | "idoc"
  | "delivery"
  | "availability_check"
  | "purchasing"
  | "invoice_verification"
  | "subcontracting"
  | "stock_transfer"
  | "handling_unit"
  | "batch_management"
  | "migration"
  | "integrations";

export type SapTaxonomySignal = {
  domains: SapDomain[];
  themes: SapTheme[];
  /**
   * Useful for debugging and future analytics (why did we classify this way?).
   * Kept short and deterministic.
   */
  matched: string[];
};

function norm(s: string): string {
  return (s ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function addUnique<T extends string>(arr: T[], v: T) {
  if (!arr.includes(v)) arr.push(v);
}

export function detectSapTaxonomy(message: string): SapTaxonomySignal {
  const m = norm(message);
  const domains: SapDomain[] = [];
  const themes: SapTheme[] = [];
  const matched: string[] = [];
  if (!m) return { domains, themes, matched };

  // Deployment model
  if (/\b(public cloud|s\/4 public cloud|sap public cloud|grow with sap)\b/i.test(m)) {
    addUnique(domains, "public_cloud");
    matched.push("public_cloud");
  }
  if (/\b(on[-\s]?prem|on[-\s]?premise|ecc|s\/4hana on[-\s]?prem)\b/i.test(m)) {
    addUnique(domains, "on_prem");
    matched.push("on_prem");
  }

  // Domains / modules
  const domainRules: Array<{ key: SapDomain; re: RegExp; tag: string }> = [
    { key: "sd", re: /\b(sd|sales and distribution|ventas|pricing|billing|vkoa|vk11|va01|vl01n)\b/i, tag: "sd" },
    { key: "mm", re: /\b(mm|materials management|compras|purchasing|migo|miro|me21n|me22n)\b/i, tag: "mm" },
    { key: "fi", re: /\b(fi|finance|finanzas|fbl1n|fb60|fb01|accounting)\b/i, tag: "fi" },
    { key: "co", re: /\b(co|controlling|copa|co-pa)\b/i, tag: "co" },
    { key: "pp", re: /\b(pp|production planning|planificación de producción)\b/i, tag: "pp" },
    { key: "qm", re: /\b(qm|quality management|calidad)\b/i, tag: "qm" },
    { key: "wm", re: /\b(wm|warehouse management)\b/i, tag: "wm" },
    { key: "ewm", re: /\b(ewm|extended warehouse management)\b/i, tag: "ewm" },
    { key: "tm", re: /\b(tm|transportation management)\b/i, tag: "tm" },
    { key: "le", re: /\b(le|logistics execution)\b/i, tag: "le" },
    { key: "basis", re: /\b(basis|st22|sm21|sm37|sm30|spau|spdd)\b/i, tag: "basis" },
    { key: "security", re: /\b(security|seguridad|roles?|authorizations?|pfcg|su01)\b/i, tag: "security" },
    { key: "abap", re: /\b(abap|se38|se24|debug|dump)\b/i, tag: "abap" },
    { key: "btp", re: /\b(btp|sap btp|cloud integration|cpi|integration suite)\b/i, tag: "btp" },
  ];
  for (const r of domainRules) {
    if (r.re.test(m)) {
      addUnique(domains, r.key);
      matched.push(r.tag);
    }
  }

  // Themes
  const themeRules: Array<{ key: SapTheme; re: RegExp; tag: string }> = [
    { key: "pricing", re: /\b(pricing|precio|precios|condition records?|vk11|vkoa|pricing procedure)\b/i, tag: "pricing" },
    { key: "billing", re: /\b(billing|facturaci[oó]n|vf01|vf02)\b/i, tag: "billing" },
    { key: "output", re: /\b(output|salida|nace|output management)\b/i, tag: "output" },
    { key: "delivery", re: /\b(delivery|entrega|vl01n|vl02n)\b/i, tag: "delivery" },
    { key: "atp", re: /\b(atp|available to promise)\b/i, tag: "atp" },
    { key: "aatp", re: /\b(aatp|advanced atp)\b/i, tag: "aatp" },
    { key: "availability_check", re: /\b(availability check|comprobaci[oó]n de disponibilidad)\b/i, tag: "availability_check" },
    { key: "idoc", re: /\b(idoc|we20|we19|we02|ale|edi)\b/i, tag: "idoc" },
    { key: "integrations", re: /\b(integration|integraci[oó]n|api|odata|cpi|middleware)\b/i, tag: "integrations" },
    { key: "migration", re: /\b(migration|migraci[oó]n|ltmc|s\/4 migration cockpit)\b/i, tag: "migration" },
    { key: "intercompany", re: /\b(intercompany|intercompa[nñ]ia|intercompañía)\b/i, tag: "intercompany" },
    { key: "consignment", re: /\b(consignment|consignaci[oó]n)\b/i, tag: "consignment" },
    { key: "purchasing", re: /\b(purchasing|compras|me21n|me22n)\b/i, tag: "purchasing" },
    { key: "invoice_verification", re: /\b(invoice verification|verificaci[oó]n de factura|miro)\b/i, tag: "invoice_verification" },
    { key: "subcontracting", re: /\b(subcontracting|subcontrataci[oó]n)\b/i, tag: "subcontracting" },
    { key: "stock_transfer", re: /\b(stock transfer|traspaso de stock|sto)\b/i, tag: "stock_transfer" },
    { key: "handling_unit", re: /\b(handling unit|hu\b)\b/i, tag: "handling_unit" },
    { key: "batch_management", re: /\b(batch management|lotes?)\b/i, tag: "batch_management" },
  ];
  for (const r of themeRules) {
    if (r.re.test(m)) {
      addUnique(themes, r.key);
      matched.push(r.tag);
    }
  }

  return {
    domains,
    themes,
    matched: matched.slice(0, 12),
  };
}

