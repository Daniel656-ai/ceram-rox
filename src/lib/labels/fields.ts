export interface LabelFieldDef {
  key: string;
  label: string;
  group: "Stammdaten" | "Gebinde" | "Firma" | "System";
  sample: string;
}

export const LABEL_FIELDS: LabelFieldDef[] = [
  // Stammdaten
  { key: "material.name", label: "Rohstoffname", group: "Stammdaten", sample: "Aluminiumoxid" },
  { key: "material.other_designation", label: "Sonstige Bezeichnung", group: "Stammdaten", sample: "Al₂O₃ technisch" },
  { key: "material.description", label: "Bemerkung", group: "Stammdaten", sample: "weißes Pulver" },
  { key: "material.material_number", label: "RK-Code", group: "Stammdaten", sample: "RK-1234" },
  { key: "material.mrs_number", label: "MRS-Nummer", group: "Stammdaten", sample: "MRS-9876" },
  { key: "material.supplier", label: "Lieferant", group: "Stammdaten", sample: "Muster GmbH" },
  { key: "material.cas_number", label: "CAS-Nr.", group: "Stammdaten", sample: "1344-28-1" },
  { key: "batch.lot_number", label: "LOT-Nummer", group: "Stammdaten", sample: "LOT-2026-042" },
  // Gebinde
  { key: "container.container_code", label: "Gebinde-ID", group: "Gebinde", sample: "G-000123" },
  { key: "container.kind", label: "Gebindeart", group: "Gebinde", sample: "Bigbag" },
  { key: "container.initial_quantity", label: "Gebindegröße", group: "Gebinde", sample: "25 kg" },
  { key: "container.current_quantity", label: "Füllmenge (aktuell)", group: "Gebinde", sample: "18,4 kg" },
  { key: "container.unit", label: "Einheit", group: "Gebinde", sample: "kg" },
  { key: "container.location", label: "Lagerort", group: "Gebinde", sample: "Halle 1 › R-12 › F-3" },
  { key: "container.created_at", label: "Anlagedatum", group: "Gebinde", sample: "24.06.2026" },
  { key: "batch.expiry_date", label: "Verfallsdatum", group: "Gebinde", sample: "31.12.2027" },
  { key: "batch.delivery_date", label: "Lieferdatum", group: "Gebinde", sample: "15.06.2026" },
  // Firma
  { key: "company.name", label: "Firmenname", group: "Firma", sample: "Ceram Austria GmbH" },
  { key: "company.address", label: "Firmenadresse", group: "Firma", sample: "Musterstraße 1, 1010 Wien" },
  // System
  { key: "system.print_date", label: "Druckdatum", group: "System", sample: "24.06.2026" },
];

function fmtDate(v: unknown): string {
  if (!v) return "";
  try { return new Date(String(v)).toLocaleDateString("de-DE"); } catch { return String(v); }
}

function fmtQty(qty: unknown, unit?: unknown): string {
  if (qty == null) return "";
  const n = typeof qty === "number" ? qty : Number(qty);
  if (Number.isNaN(n)) return String(qty);
  const s = n.toLocaleString("de-DE", { maximumFractionDigits: 3 });
  return unit ? `${s} ${unit}` : s;
}

export interface LabelDataContext {
  material?: any;
  container?: any;
  batch?: any;
  location?: any; // { hall, room, shelf, name }
  company?: { name?: string | null; address?: string | null; logo_data_url?: string | null };
  hazardGhsKeys?: string[];
  psaKeys?: string[];
}

export function resolveField(key: string, ctx: LabelDataContext): string {
  const m = ctx.material ?? {};
  const c = ctx.container ?? {};
  const b = ctx.batch ?? {};
  const l = ctx.location ?? {};
  const co = ctx.company ?? {};
  switch (key) {
    case "material.name": return m.material_name ?? "";
    case "material.other_designation": return m.other_designation ?? "";
    case "material.description": return m.description ?? "";
    case "material.material_number": return m.material_number ?? "";
    case "material.mrs_number": return m.mrs_number ?? "";
    case "material.supplier": return m.supplier ?? "";
    case "material.cas_number": return m.cas_number ?? "";
    case "batch.lot_number": return b.lot_number ?? b.batch_number ?? "";
    case "container.container_code": return c.container_code ?? "";
    case "container.kind": return c.kind ?? "";
    case "container.initial_quantity": return fmtQty(c.initial_quantity, c.unit);
    case "container.current_quantity": return fmtQty(c.current_quantity, c.unit);
    case "container.unit": return c.unit ?? m.unit ?? "";
    case "container.location":
      return [l.hall, l.room, l.shelf].filter(Boolean).join(" › ") || l.name || c.location_note || "";
    case "container.created_at": return fmtDate(c.created_at);
    case "batch.expiry_date": return fmtDate(b.expiry_date);
    case "batch.delivery_date": return fmtDate(b.delivery_date ?? b.received_at);
    case "company.name": return co.name ?? "";
    case "company.address": return co.address ?? "";
    case "system.print_date": return new Date().toLocaleDateString("de-DE");
    default: return "";
  }
}

export const LABEL_CATEGORIES = [
  { key: "rohstoff", label: "Rohstoff" },
  { key: "gefahrstoff", label: "Gefahrstoff" },
  { key: "produktionsgebinde", label: "Produktionsgebinde" },
  { key: "laborprobe", label: "Laborprobe" },
  { key: "zwischenprodukt", label: "Zwischenprodukt" },
  { key: "fertigprodukt", label: "Fertigprodukt" },
  { key: "sonstige", label: "Sonstige" },
];

export const PRESET_SIZES = [
  { label: "50 × 30 mm", w: 50, h: 30 },
  { label: "70 × 40 mm", w: 70, h: 40 },
  { label: "100 × 50 mm", w: 100, h: 50 },
  { label: "A7 (74 × 105 mm)", w: 74, h: 105 },
  { label: "A6 (105 × 148 mm)", w: 105, h: 148 },
];
