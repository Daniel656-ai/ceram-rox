import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

/**
 * Filterzustand der Ergebnisdatenbank. Die Filter wirken gleichzeitig auf
 * Probenübersicht, Ergebnismatrix und Statistik.
 */
export interface ResultsFilters {
  searchText: string;
  serviceFilter: string;
  projectFilter: string;
  sampleFilter: string;
  creatorFilter: string;
  technicianFilter: string;
  conditionKey: string;
  conditionValue: string;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_RESULTS_FILTERS: ResultsFilters = {
  searchText: "",
  serviceFilter: "all",
  projectFilter: "all",
  sampleFilter: "",
  creatorFilter: "all",
  technicianFilter: "all",
  conditionKey: "all",
  conditionValue: "all",
  dateFrom: "",
  dateTo: "",
};

export interface ActiveFilterChip {
  /** Eindeutige Kennung des Chips. */
  id: string;
  /** Anzeigetext, z. B. „Projekt: Glasur 2026“. */
  label: string;
  /** Liegt der Filter hinter „Weitere Filter“? */
  secondary: boolean;
  /** Änderung, die diesen einen Filter zurücksetzt. */
  reset: Partial<ResultsFilters>;
}

const fmtDate = (iso: string) => {
  try {
    return format(parseISO(iso), "dd.MM.yyyy", { locale: de });
  } catch {
    return iso;
  }
};

/** Alle aktiven Filter als einzeln entfernbare Chips (feste Reihenfolge). */
export function activeFilterChips(f: ResultsFilters): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  const text = (v: string) => v.trim() !== "";
  const sel = (v: string) => v !== "all" && v !== "";

  if (text(f.searchText))
    chips.push({ id: "search", label: `Suche: ${f.searchText.trim()}`, secondary: false, reset: { searchText: "" } });
  if (sel(f.serviceFilter))
    chips.push({ id: "service", label: `Messart: ${f.serviceFilter}`, secondary: false, reset: { serviceFilter: "all" } });
  if (sel(f.projectFilter))
    chips.push({ id: "project", label: `Projekt: ${f.projectFilter}`, secondary: false, reset: { projectFilter: "all" } });
  if (text(f.sampleFilter))
    chips.push({ id: "sample", label: `Proben-ID: ${f.sampleFilter.trim()}`, secondary: false, reset: { sampleFilter: "" } });
  if (sel(f.creatorFilter))
    chips.push({ id: "creator", label: `Auftraggeber: ${f.creatorFilter}`, secondary: true, reset: { creatorFilter: "all" } });
  if (sel(f.technicianFilter))
    chips.push({ id: "technician", label: `Messdienstleister: ${f.technicianFilter}`, secondary: true, reset: { technicianFilter: "all" } });
  if (sel(f.conditionKey))
    chips.push({
      id: "condition",
      label: sel(f.conditionValue) ? `${f.conditionKey}: ${f.conditionValue}` : `Merkmal: ${f.conditionKey}`,
      secondary: true,
      reset: { conditionKey: "all", conditionValue: "all" },
    });
  if (text(f.dateFrom))
    chips.push({ id: "dateFrom", label: `Ab ${fmtDate(f.dateFrom)}`, secondary: true, reset: { dateFrom: "" } });
  if (text(f.dateTo))
    chips.push({ id: "dateTo", label: `Bis ${fmtDate(f.dateTo)}`, secondary: true, reset: { dateTo: "" } });

  return chips;
}

/** Anzahl aktiver Filter hinter „Weitere Filter“ (für die Zahl am Knopf). */
export function countSecondaryActive(f: ResultsFilters): number {
  return activeFilterChips(f).filter((c) => c.secondary).length;
}
