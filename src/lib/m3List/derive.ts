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
  lengthTolerance, diameterTolerance, innerWallTolerance, labScope, freeTolerance, type M3Constants,
  formatElementNumber,
} from "./calculations";
import { M3_HEADER_FIELDS, M3_ROWS_KEY } from "./template";
import { crossSectionFromRelease } from "@/lib/productionRelease/dimensions";
import { benchExtraTestPieces } from "@/lib/samplingCodeMap";

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
  // Querschnitt: Breite und Höhe getrennt, Anzeige „152 mm × 152 mm“.
  // Kein stilles Korrigieren unplausibler Altwerte – nur Hinweis.
  const cs = crossSectionFromRelease(release);
  values.cross_section_mm = cs.display;
  values.cross_section_width_mm = cs.width;
  values.cross_section_height_mm = cs.height;
  if (cs.width != null && cs.height == null && cs.width > 1000) {
    notices.push(
      `Der Querschnitt in der Produktionsfreigabe ist unplausibel (${cs.display}). Vermutlich wurden zwei Maße zusammengefügt – bitte die Freigabe prüfen und korrigieren oder neu importieren.`
    );
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
      `Plausibilitätsprüfung: Zellkonfiguration der Produktionsfreigabe (${cellsFromRelease}) weicht von der Auftragsnummer (${cellsFromOrder}) ab.`
    );
  }
  if (cellsFromRelease == null && cellsFromOrder != null) {
    notices.push("Die Zellenzahl stammt aus der Auftragsnummer – in der Produktionsfreigabe ist keine Zellkonfiguration hinterlegt.");
  }

  const variant = num(stored.tolerance_variant) ?? 1;
  // Freie Toleranzen ergänzen die Varianten 1/2 (nur wenn beide Werte gültig sind).
  const freeL = stored.tolerance_free === true ? freeTolerance(stored.tol_length_plus, stored.tol_length_minus) : null;
  const freeD = stored.tolerance_free === true ? freeTolerance(stored.tol_diameter_plus, stored.tol_diameter_minus) : null;
  values.length_tolerance = freeL ?? lengthTolerance(variant);
  values.diameter_tolerance = freeD ?? diameterTolerance(variant);
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
  values.bench_extra_pieces = benchExtraTestPieces(manual ?? scope.tests);
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
    values.regular_element_total = null;
    values.total_element_count = null;
    values[M3_ROWS_KEY] = rows.map((r) => ({ ...r, element_count: null, element_number: null, row_labor_kat: null }));
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

  const derivedRows = rows.map((r) => {
    const count = elementCountForRow(num(r.volume_m3) ?? 0, lengthMm, constants);
    const formatted = num(r.volume_m3) == null ? "—" : formatElementNumber(count);
    return { ...r, element_count: count, element_number: formatted === "—" ? null : formatted, row_labor_kat: kat?.count ?? null };
  });
  values[M3_ROWS_KEY] = derivedRows;

  // Gesamtmenge = reguläre Elementanzahl (Summe der Zeilen, unverändert berechnet)
  // + Bench-Zusatz (0/1). Stets neu abgeleitet und nie gespeichert → keine Doppeladdition.
  const regular = derivedRows.reduce((s, r) => s + (typeof r.element_count === "number" ? r.element_count : 0), 0);
  values.regular_element_total = derivedRows.length ? regular : null;
  values.total_element_count = derivedRows.length ? regular + (values.bench_extra_pieces as number) : null;

  return { values, notices, cellCount };
}

/** Nur die vom Mitarbeiter erfassten Werte speichern (berechnete bleiben abgeleitet). */
export function stripDerivedValues(values: Record<string, unknown>): Record<string, unknown> {
  const derivedKeys = new Set([
    ...M3_HEADER_FIELDS.map((f) => f.field_key),
    "release_label", "cell_count", "cross_section_width_mm", "cross_section_height_mm", "elements_per_m3", "marking_elements", "marking_rows",
    "laborkat_length_mm", "required_length_mm", "labor_kat_count", "micro_nox", "micro_sox",
    "length_tolerance", "diameter_tolerance", "inner_wall_tolerance", "lab_tests", "lab_tests_auto",
    "bench_extra_pieces", "regular_element_total", "total_element_count",
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (derivedKeys.has(k)) continue;
    if (k === M3_ROWS_KEY && Array.isArray(v)) {
      out[k] = v.map((row) => {
        const { element_count: _a, row_labor_kat: _b, element_number: _c, ...rest } = (row ?? {}) as Record<string, unknown>;
        return rest;
      });
      continue;
    }
    out[k] = v;
  }
  return out;
}
