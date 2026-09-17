/**
 * Ableitung der Formularwerte einer m³-Liste.
 *
 * Graue Werte kommen AUSSCHLIESSLICH aus der gespeicherten
 * Fertigungsfreigabe-Revision (kein Fallback auf eine andere Revision),
 * gelbe Werte stammen aus der gespeicherten Formularinstanz, berechnete Werte
 * ermittelt ROX nach der Excel-Fachlogik.
 */
import {
  elementsPerCubicMeter, elementCountForRow, markingElements, markingRows, laborKat,
  cellCountFromConfiguration, cellCountFromOrderNumber, noxMicro, soxMicro,
  lengthTolerance, diameterTolerance, innerWallTolerance, labScope, type M3Constants,
} from "./calculations";
import { M3_HEADER_FIELDS, M3_ROWS_KEY } from "./template";

/** Gespeicherte, manuell änderbare Beprobungsauswahl (Kürzel-Liste). */
export const M3_LAB_SELECTION_KEY = "lab_tests_selected";

export interface M3DeriveInput {
  release: Record<string, unknown> | null;
  orderNumber: string | null;
  stored: Record<string, unknown>;
  constants: M3Constants | null;
}

export interface M3DeriveResult {
  values: Record<string, unknown>;
  /** Fachliche Hinweise (z. B. Plausibilität Zellenzahl, SOx entfällt). */
  notices: string[];
  cellCount: number | null;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export function deriveM3Values({ release, orderNumber, stored, constants }: M3DeriveInput): M3DeriveResult {
  const values: Record<string, unknown> = { ...stored };
  const notices: string[] = [];

  // --- graue Kopfdaten aus genau dieser Revision -------------------------
  for (const spec of M3_HEADER_FIELDS) {
    if (!spec.release_field) continue;
    const raw = release ? (release as Record<string, unknown>)[spec.release_field] : undefined;
    values[spec.field_key] = raw ?? null;
  }
  values.order_number = orderNumber ?? (release?.order_number as string | undefined) ?? null;
  values.release_label = release
    ? `${String(release.release_number ?? "–")} · Rev${Number(release.revision_number) || 0}`
    : null;

  const lengthMm = num(release?.length_mm);
  const cellsFromRelease = cellCountFromConfiguration(release?.cell_configuration);
  const cellsFromOrder = cellCountFromOrderNumber(values.order_number as string | null);
  const cellCount = cellsFromRelease ?? cellsFromOrder;
  values.cell_count = cellCount;
  if (cellsFromRelease != null && cellsFromOrder != null && cellsFromRelease !== cellsFromOrder) {
    notices.push(
      `Plausibilitätsprüfung: Zellkonfiguration der Fertigungsfreigabe (${cellsFromRelease}) weicht von der Auftragsnummer (${cellsFromOrder}) ab.`
    );
  }
  if (cellsFromRelease == null && cellsFromOrder != null) {
    notices.push("Die Zellenzahl stammt aus der Auftragsnummer – in der Fertigungsfreigabe ist keine Zellkonfiguration hinterlegt.");
  }

  const variant = num(stored.tolerance_variant) ?? 1;
  values.length_tolerance = lengthTolerance(variant);
  values.diameter_tolerance = diameterTolerance(variant);
  values.inner_wall_tolerance = innerWallTolerance(cellCount);

  const nox = lengthMm != null ? noxMicro(cellCount, lengthMm, num(stored.av_nox)) : null;
  const sox = lengthMm != null ? soxMicro(cellCount, lengthMm, num(stored.av_sox)) : null;
  values.micro_nox = nox?.label ?? null;
  values.micro_sox = sox?.label ?? null;

  const scope = labScope({
    soxRequired: stored.sox_required === true,
    deliveryVolumeM3: num(stored.delivery_volume_m3),
    cells: cellCount,
  });
  // Automatik = nur Vorschlag. Sobald der Benutzer die Auswahl gespeichert hat,
  // ist ausschließlich diese Auswahl maßgeblich (auch eine leere Auswahl).
  const manual = Array.isArray(stored[M3_LAB_SELECTION_KEY])
    ? (stored[M3_LAB_SELECTION_KEY] as unknown[]).map((c) => String(c).trim()).filter(Boolean)
    : null;
  values.lab_tests_auto = scope.text;
  values[M3_LAB_SELECTION_KEY] = manual;
  values.lab_tests = (manual ?? scope.tests).join(", ");
  if (scope.soxDroppedByVolume) {
    notices.push("SOx ist gefordert, entfällt aber laut Fachlogik, weil die Liefermenge über 20 m³ liegt. Bitte bestätigen.");
  }

  // --- Berechnungen mit Konstanten ---------------------------------------
  const rows = Array.isArray(stored[M3_ROWS_KEY]) ? (stored[M3_ROWS_KEY] as Record<string, unknown>[]) : [];
  if (!constants || lengthMm == null) {
    values.elements_per_m3 = null;
    values.marking_elements = null;
    values.marking_rows = null;
    values.laborkat_length_mm = null;
    values.required_length_mm = null;
    values.labor_kat_count = null;
    values[M3_ROWS_KEY] = rows.map((r) => ({ ...r, element_count: null, row_labor_kat: null }));
    if (lengthMm == null) notices.push("In der hinterlegten Revision ist keine Länge vorhanden – die Berechnungen sind nicht möglich.");
    return { values, notices, cellCount };
  }

  const perM3 = elementsPerCubicMeter(lengthMm, constants);
  const marking = markingElements(num(stored.spare_elements) ?? 0, num(stored.mounting_frames) ?? 0);
  const kat = laborKat(lengthMm, constants);

  values.elements_per_m3 = perM3 != null ? Math.round(perM3 * 100) / 100 : null;
  values.marking_elements = marking;
  values.marking_rows = markingRows(marking, perM3);
  values.laborkat_length_mm = kat?.laborKatLengthMm ?? null;
  values.required_length_mm = kat?.requiredLengthMm ?? null;
  values.labor_kat_count = kat?.count ?? null;

  values[M3_ROWS_KEY] = rows.map((r) => ({
    ...r,
    element_count: elementCountForRow(num(r.volume_m3) ?? 0, lengthMm, constants),
    row_labor_kat: kat?.count ?? null,
  }));

  return { values, notices, cellCount };
}

/** Nur die vom Mitarbeiter erfassten Werte speichern (berechnete bleiben abgeleitet). */
export function stripDerivedValues(values: Record<string, unknown>): Record<string, unknown> {
  const derivedKeys = new Set([
    ...M3_HEADER_FIELDS.map((f) => f.field_key),
    "release_label", "cell_count", "elements_per_m3", "marking_elements", "marking_rows",
    "laborkat_length_mm", "required_length_mm", "labor_kat_count", "micro_nox", "micro_sox",
    "length_tolerance", "diameter_tolerance", "inner_wall_tolerance", "lab_tests", "lab_tests_auto",
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (derivedKeys.has(k)) continue;
    if (k === M3_ROWS_KEY && Array.isArray(v)) {
      out[k] = v.map((row) => {
        const { element_count: _a, row_labor_kat: _b, ...rest } = (row ?? {}) as Record<string, unknown>;
        return rest;
      });
      continue;
    }
    out[k] = v;
  }
  return out;
}
