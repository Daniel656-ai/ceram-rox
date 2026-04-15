import * as XLSX from "xlsx";

export interface ImportedOrderRow {
  project_number: string;
  project_name?: string;
  sample_name: string;
  sample_description: string;
  order_type: string;
  priority: string;
  due_date?: string;
  notes?: string;
  service_name: string;
  planned_hours: number;
  // Dynamic parameter values keyed by parameter name
  parameters?: Record<string, string>;
}

export interface ParsedImportOrder {
  project_number: string;
  project_name?: string;
  order_type: string;
  priority: string;
  due_date?: string;
  notes?: string;
  sample: {
    sample_name: string;
    sample_description: string;
  };
  measurements: {
    service_name: string;
    planned_hours: number;
    matched_service_id?: string;
    matched_workstation_id?: string;
    parameters?: Record<string, string>;
  }[];
  errors: string[];
}

export const VALID_ORDER_TYPES = ["customer", "production", "rnd"];
export const VALID_PRIORITIES = ["normal", "wichtig", "hoechste"];

export const ORDER_TYPE_MAP: Record<string, string> = {
  kundenauftrag: "customer",
  customer: "customer",
  produktionsauftrag: "production",
  production: "production",
  "f&e-auftrag": "rnd",
  "f&e": "rnd",
  rnd: "rnd",
};

export const PRIORITY_MAP: Record<string, string> = {
  normal: "normal",
  wichtig: "wichtig",
  höchste: "hoechste",
  hoechste: "hoechste",
};

// Known fixed columns that are NOT parameters
const FIXED_COLUMNS = new Set([
  "projektnummer", "project_number",
  "projektname", "project_name",
  "probenname", "sample_name",
  "probenbeschreibung", "sample_description",
  "auftragstyp", "order_type",
  "priorität", "priority",
  "fälligkeitsdatum", "due_date",
  "anmerkungen", "notes",
  "dienstleistung", "service_name",
  "geplante stunden", "planned_hours",
]);

export function parseExcelFile(buffer: ArrayBuffer): { rows: ImportedOrderRow[]; extraColumns: string[] } {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

  // Detect extra columns (potential parameters)
  const extraColumns: string[] = [];
  if (raw.length > 0) {
    for (const key of Object.keys(raw[0])) {
      if (!FIXED_COLUMNS.has(key.toLowerCase().trim())) {
        extraColumns.push(key);
      }
    }
  }

  const rows = raw.map((row) => {
    const params: Record<string, string> = {};
    for (const col of extraColumns) {
      const val = row[col];
      if (val != null && String(val).trim()) {
        params[col] = String(val).trim();
      }
    }

    return {
      project_number: String(row["Projektnummer"] || row["project_number"] || "").trim(),
      project_name: String(row["Projektname"] || row["project_name"] || "").trim() || undefined,
      sample_name: String(row["Probenname"] || row["sample_name"] || "").trim(),
      sample_description: String(row["Probenbeschreibung"] || row["sample_description"] || "").trim(),
      order_type: String(row["Auftragstyp"] || row["order_type"] || "").trim(),
      priority: String(row["Priorität"] || row["priority"] || "normal").trim(),
      due_date: row["Fälligkeitsdatum"] || row["due_date"] ? String(row["Fälligkeitsdatum"] || row["due_date"]).trim() : undefined,
      notes: String(row["Anmerkungen"] || row["notes"] || "").trim() || undefined,
      service_name: String(row["Dienstleistung"] || row["Messdienstleistung"] || row["service_name"] || "").trim(),
      planned_hours: Number(row["Geplante Stunden"] || row["planned_hours"]) || 1,
      parameters: Object.keys(params).length > 0 ? params : undefined,
    };
  });

  return { rows, extraColumns };
}

export function groupRowsIntoOrders(
  rows: ImportedOrderRow[],
  existingServices: { id: string; service_name: string; workstation_id: string | null }[]
): ParsedImportOrder[] {
  const groups = new Map<string, ImportedOrderRow[]>();
  for (const row of rows) {
    const key = `${row.project_number}||${row.sample_name}||${row.order_type}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  return Array.from(groups.values()).map((groupRows) => {
    const first = groupRows[0];
    const errors: string[] = [];

    const mappedType = ORDER_TYPE_MAP[first.order_type.toLowerCase()] || first.order_type.toLowerCase();
    if (!VALID_ORDER_TYPES.includes(mappedType)) {
      errors.push(`Ungültiger Auftragstyp: "${first.order_type}"`);
    }

    const mappedPriority = PRIORITY_MAP[first.priority.toLowerCase()] || first.priority.toLowerCase();
    if (!VALID_PRIORITIES.includes(mappedPriority)) {
      errors.push(`Ungültige Priorität: "${first.priority}"`);
    }

    if (!first.project_number) errors.push("Projektnummer fehlt");
    if (!first.sample_name) errors.push("Probenname fehlt");
    if (!first.sample_description) errors.push("Probenbeschreibung fehlt");

    const measurements = groupRows.map((r) => {
      const match = existingServices.find(
        (s) => s.service_name.toLowerCase() === r.service_name.toLowerCase()
      );
      if (!match) errors.push(`Dienstleistung nicht gefunden: "${r.service_name}"`);
      return {
        service_name: r.service_name,
        planned_hours: r.planned_hours,
        matched_service_id: match?.id,
        matched_workstation_id: match?.workstation_id || undefined,
        parameters: r.parameters,
      };
    });

    if (measurements.length === 0) errors.push("Keine Aufgaben angegeben");

    return {
      project_number: first.project_number,
      project_name: first.project_name,
      order_type: mappedType,
      priority: mappedPriority,
      due_date: first.due_date,
      notes: first.notes,
      sample: {
        sample_name: first.sample_name,
        sample_description: first.sample_description,
      },
      measurements,
      errors,
    };
  });
}

export function generateTemplate(): void {
  const headers = [
    "Projektnummer",
    "Projektname",
    "Probenname",
    "Probenbeschreibung",
    "Auftragstyp",
    "Priorität",
    "Fälligkeitsdatum",
    "Anmerkungen",
    "Dienstleistung",
    "Geplante Stunden",
  ];

  const example = [
    "PRJ-2025-001",
    "Beispielprojekt",
    "Probe A",
    "Beschreibung der Probe",
    "Kundenauftrag",
    "Normal",
    "2025-12-31",
    "",
    "Name der Dienstleistung",
    "2",
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Messaufträge");
  XLSX.writeFile(wb, "Messauftrag-Vorlage.xlsx");
}

export type RowFieldErrors = Record<string, string>;

export function validateRows(
  rows: ImportedOrderRow[],
  existingServices: { id: string; service_name: string; workstation_id: string | null }[]
): RowFieldErrors[] {
  return rows.map((row) => {
    const errors: RowFieldErrors = {};

    if (!row.project_number.trim()) errors.project_number = "Projektnummer fehlt";
    if (!row.sample_name.trim()) errors.sample_name = "Probenname fehlt";
    if (!row.sample_description.trim()) errors.sample_description = "Probenbeschreibung fehlt";

    if (!row.order_type.trim()) {
      errors.order_type = "Auftragstyp fehlt";
    } else {
      const mapped = ORDER_TYPE_MAP[row.order_type.toLowerCase()];
      if (!mapped) errors.order_type = `Ungültiger Auftragstyp: "${row.order_type}"`;
    }

    if (row.priority.trim()) {
      const mapped = PRIORITY_MAP[row.priority.toLowerCase()];
      if (!mapped) errors.priority = `Ungültige Priorität: "${row.priority}"`;
    }

    if (!row.service_name.trim()) {
      errors.service_name = "Dienstleistung fehlt";
    } else {
      const match = existingServices.find(
        (s) => s.service_name.toLowerCase() === row.service_name.toLowerCase()
      );
      if (!match) errors.service_name = `Nicht gefunden: "${row.service_name}"`;
    }

    if (row.planned_hours <= 0) errors.planned_hours = "Muss größer als 0 sein";

    return errors;
  });
}
