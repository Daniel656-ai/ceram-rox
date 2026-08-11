import {
  SYSTEM_ALIASES,
  SYSTEM_NAMESPACE_LABELS,
  type SystemNamespace,
} from "@/lib/systemVariables";

// Zentraler Katalog aller verfügbaren Platzhalter für den Berichtsdesigner.
// Wird sowohl im Designer (Auswahl / Live-Preview) als auch beim Rendern
// (Edge Function) verwendet.

export interface PlaceholderDef {
  key: string;       // z.B. "order.order_number"
  token: string;     // z.B. "{{Auftragsnummer}}"
  label: string;
  example?: string;
}

export interface PlaceholderGroup {
  label: string;
  items: PlaceholderDef[];
}

export const PLACEHOLDER_CATALOG: PlaceholderGroup[] = [
  {
    label: "Auftrag",
    items: [
      { key: "order.order_number", token: "{{Auftragsnummer}}", label: "Auftragsnummer", example: "L2500123" },
      { key: "order.pp_experiment_number", token: "{{Versuchsnummer}}", label: "Versuchsnummer", example: "V-2025-01" },
      { key: "order.order_type", token: "{{Auftragsart}}", label: "Auftragsart" },
      { key: "order.order_kind", token: "{{Auftragskategorie}}", label: "Auftragskategorie" },
      { key: "order.status", token: "{{Status}}", label: "Status" },
      { key: "order.priority", token: "{{Prioritaet}}", label: "Priorität" },
      { key: "order.created_at", token: "{{Erstellt}}", label: "Erstellt am" },
      { key: "order.completed_at", token: "{{Abgeschlossen}}", label: "Abschlussdatum" },
      { key: "order.due_date", token: "{{Faelligkeit}}", label: "Fälligkeit" },
      { key: "order.created_by_name", token: "{{Ersteller}}", label: "Ersteller" },
      { key: "order.responsible_name", token: "{{Bearbeiter}}", label: "Bearbeiter" },
      { key: "order.notes", token: "{{Auftragsnotizen}}", label: "Notizen" },
    ],
  },
  {
    label: "Projekt & Kunde",
    items: [
      { key: "project.project_number", token: "{{Projektnummer}}", label: "Projektnummer" },
      { key: "project.project_name", token: "{{Projekt}}", label: "Projekt" },
      { key: "project.customer", token: "{{Kunde}}", label: "Kunde" },
      { key: "project.project_manager", token: "{{Projektleiter}}", label: "Projektleiter" },
      { key: "project.status", token: "{{Projektstatus}}", label: "Projektstatus" },
    ],
  },
  {
    label: "Probe",
    items: [
      { key: "sample.sample_number", token: "{{Probennummer}}", label: "Probennummer" },
      { key: "sample.sample_name", token: "{{Probe}}", label: "Probe" },
      { key: "sample.material_type", token: "{{Material}}", label: "Material" },
      { key: "sample.description", token: "{{Probenbeschreibung}}", label: "Probenbeschreibung" },
    ],
  },
  {
    label: "Auftraggeberformular",
    items: [
      { key: "customer_form.*", token: "{{AG:feldschluessel}}", label: "Beliebiges AG-Feld (Schlüssel eintragen)" },
    ],
  },
  {
    label: "Messdienstleisterformular",
    items: [
      { key: "employee_form.*", token: "{{MDL:feldschluessel}}", label: "Beliebiges MDL-Feld (Schlüssel eintragen)" },
    ],
  },
  {
    label: "Rohstoffe & Rezeptur",
    items: [
      { key: "raw_material.recipe", token: "{{Rezeptur}}", label: "Rezeptur (Tabelle)" },
      { key: "raw_material.recipe[0].material", token: "{{Hauptrohstoff}}", label: "Hauptrohstoff" },
      { key: "raw_material.consumed_lots", token: "{{Lotnummern}}", label: "Verbrauchte Lots" },
    ],
  },
  {
    label: "Messwerte",
    items: [
      { key: "measurement_result", token: "{{Messwerte}}", label: "Alle Messwerte (Tabelle)" },
      { key: "measurement_parameter", token: "{{Messparameter}}", label: "Alle Messparameter (Tabelle)" },
    ],
  },
  {
    label: "Workflow",
    items: [
      { key: "workflow.steps", token: "{{Prozessschritte}}", label: "Prozessschritte (Tabelle)" },
      { key: "workflow.current_step", token: "{{AktuellerSchritt}}", label: "Aktueller Schritt" },
      { key: "workflow.approvals", token: "{{Freigaben}}", label: "Freigaben" },
      { key: "workflow.completed_steps", token: "{{AbgeschlosseneSchritte}}", label: "Anzahl abgeschlossener Schritte" },
    ],
  },
  {
    label: "Dienstleistungen",
    items: [
      { key: "service.names", token: "{{Dienstleistungen}}", label: "Dienstleistungen" },
      { key: "service.list", token: "{{Dienstleistungsliste}}", label: "Dienstleistungen (Tabelle)" },
    ],
  },
  {
    label: "Arbeitszeiten",
    items: [
      { key: "worklog.entries", token: "{{Arbeitszeiten}}", label: "Arbeitszeiten (Tabelle)" },
      { key: "worklog.total_hours", token: "{{ArbeitszeitGesamt}}", label: "Arbeitszeit gesamt (h)" },
      { key: "worklog.by_user", token: "{{ArbeitszeitProPerson}}", label: "Arbeitszeit pro Person" },
    ],
  },
  {
    label: "Anhänge",
    items: [
      { key: "attachment.all", token: "{{Anhaenge}}", label: "Alle Anhänge" },
      { key: "attachment.photos", token: "{{Fotos}}", label: "Fotos" },
      { key: "attachment.documents", token: "{{Dokumente}}", label: "Dokumente" },
    ],
  },
  {
    label: "System",
    items: [
      { key: "system.generated_at", token: "{{ErzeugtAm}}", label: "Berichtsdatum" },
      { key: "system.version_no", token: "{{Version}}", label: "Version" },
      { key: "system.company_name", token: "{{Firma}}", label: "Firmenname" },
    ],
  },
  // Systemvariablen des Prozessmanagers (Auftrag/Probe/Projekt/Benutzer/Prozess).
  // Werden automatisch aus dem zentralen Katalog abgeleitet – neue Standardfelder
  // stehen ohne Änderung am Berichtsdesigner zur Verfügung.
  ...(Object.entries(SYSTEM_ALIASES).map(([ns, aliases]) => ({
    label: `Systemvariablen · ${SYSTEM_NAMESPACE_LABELS[ns as SystemNamespace]}`,
    items: aliases.map((a) => ({
      key: `${ns}.${a.name}`,
      token: `{{${ns}.${a.name}}}`,
      label: a.label,
    })),
  })) as PlaceholderGroup[]),
];

// Mapping von Token -> Pfad im Snapshot
export const TOKEN_TO_PATH: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const g of PLACEHOLDER_CATALOG) {
    for (const p of g.items) {
      if (!p.token.includes(":") && !p.token.includes("*")) {
        m[p.token] = p.key;
      }
    }
  }
  return m;
})();

/** Löst einen Pfad wie "order.order_number" oder "customer_form.probe" im Snapshot auf. */
export function resolvePath(snapshot: any, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split(/\.|\[|\]/).filter(Boolean);
  let cur: any = snapshot;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p as any];
  }
  return cur;
}

export function formatPlaceholderValue(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Ja" : "Nein";
  if (Array.isArray(v)) {
    if (!v.length) return "—";
    if (typeof v[0] === "object") return v.map((x) => Object.values(x).join(" · ")).join("\n");
    return v.join(", ");
  }
  if (typeof v === "object") {
    return Object.entries(v as any).map(([k, val]) => `${k}: ${val}`).join(" · ");
  }
  const s = String(v);
  // ISO Datum hübsch machen
  if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(s)) {
    try { return new Date(s).toLocaleString("de-AT"); } catch { /* noop */ }
  }
  return s;
}

/** Ersetzt {{Token}}, {{AG:key}}, {{MDL:key}} und {{pfad.zum.feld}} durch Werte aus dem Snapshot. */
export function replaceTokens(text: string, snapshot: any): string {
  if (!text) return "";
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, raw: string) => {
    const t = raw.trim();
    if (t.startsWith("AG:")) {
      const key = t.slice(3).trim();
      return formatPlaceholderValue(resolvePath(snapshot, `customer_form.${key}`));
    }
    if (t.startsWith("MDL:")) {
      const key = t.slice(4).trim();
      return formatPlaceholderValue(resolvePath(snapshot, `employee_form.${key}`));
    }
    const token = `{{${t}}}`;
    const path = TOKEN_TO_PATH[token];
    if (path) return formatPlaceholderValue(resolvePath(snapshot, path));
    // Freie Pfadangabe, z.B. {{customer_form.hauptrohstoff}}
    if (t.includes(".")) {
      const v = resolvePath(snapshot, t);
      if (v !== undefined) return formatPlaceholderValue(v);
    }
    return _m;
  });
}


// Beispiel-Snapshot für die Live-Vorschau im Designer.
export const SAMPLE_SNAPSHOT: any = {
  order: {
    order_number: "L2500123",
    pp_experiment_number: "V-2025-042",
    order_type: "labor",
    order_kind: "Chemische Analyse",
    status: "in_progress",
    priority: "hoch",
    created_at: "2025-11-04T09:15:00Z",
    completed_at: null,
    due_date: "2025-11-14",
    created_by_name: "Max Mustermann",
    responsible_name: "Anna Berger",
    notes: "Bitte vorrangig behandeln.",
  },
  project: {
    project_number: "P-2025-007",
    project_name: "Keramik Frittprobe 42",
    customer: "Beispiel GmbH",
    project_manager: "Julia Sailer",
    status: "aktiv",
  },
  sample: {
    sample_number: "P2500456",
    sample_name: "Probe A – Charge 4",
    material_type: "Frittmasse",
    description: "Ofenprobe bei 1200 °C",
  },
  customer_form: { probe: "A/4", zielwert: "12 %", bemerkung: "Vergleichsmessung" },
  employee_form: { messwert: "12.4 %", geraet: "Analyzer 3000" },
  measurement_parameter: [
    { measurement: "M001", parameter_name: "Temperatur", parameter_value: "1200", unit: "°C" },
    { measurement: "M001", parameter_name: "Dauer", parameter_value: "45", unit: "min" },
  ],
  measurement_result: [
    { measurement: "M001", result_name: "V2O5", value: "12.4", unit: "%" },
    { measurement: "M001", result_name: "Dichte", value: "2.61", unit: "g/cm³" },
  ],
  workflow: {
    steps: [
      { step_key: "vorbereitung", status: "completed", started_at: "2025-11-04T09:20:00Z" },
      { step_key: "messung",      status: "completed", started_at: "2025-11-04T10:05:00Z" },
      { step_key: "auswertung",   status: "in_progress" },
    ],
    approvals: [{ step: "messung", approver: "Anna Berger", at: "2025-11-04T11:00:00Z" }],
    completed_steps: 2,
    current_step: "auswertung",
  },
  raw_material: {
    recipe: [
      { material: "SiO2", code: "R-001", quantity: 50, unit: "g", lot: "L2411" },
      { material: "Al2O3", code: "R-002", quantity: 30, unit: "g", lot: "L2408" },
    ],
    consumed_lots: ["L2411", "L2408"],
  },
  service: {
    names: ["Chemische Analyse", "Röntgenfluoreszenz"],
    list: [
      { number: "M001", name: "Chemische Analyse", category: "Labor", status: "in_progress", hours: 1.5 },
    ],
  },
  worklog: {
    entries: [
      { date: "2025-11-04", user: "Anna Berger", hours: 1.5, notes: "Analyse" },
      { date: "2025-11-05", user: "Max Mustermann", hours: 0.5, notes: "Auswertung" },
    ],
    total_hours: 2.0,
    by_user: [
      { user: "Anna Berger", hours: 1.5 },
      { user: "Max Mustermann", hours: 0.5 },
    ],
  },
  attachment: {
    all: [{ name: "protokoll.pdf" }, { name: "foto1.jpg" }],
    photos: [{ name: "foto1.jpg" }],
    documents: [{ name: "protokoll.pdf" }],
  },
  system: {
    generated_at: new Date().toISOString(),
    version_no: 1,
    company_name: "Ceram ROX Demo",
  },
};
