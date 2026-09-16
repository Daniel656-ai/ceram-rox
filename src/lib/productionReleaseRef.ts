/**
 * ROX – Quellenreferenz „Feld aus einer konkreten Fertigungsfreigabe-Revision"
 * ===========================================================================
 *
 * Die m³-Liste ist eine ABLEITUNG einer Fertigungsfreigabe. Damit die Quelle
 * dauerhaft eindeutig bleibt, verweist sie nicht auf einen Stammsatz
 * (`root_release_id`) und nicht auf „die aktuelle Revision", sondern auf die
 * konkrete Zeile `production_releases.id` der ausgewählten Revision.
 *
 * Grundregeln (bewusst identisch zu `masterDataRef.ts`):
 *  - Es wird AUSSCHLIESSLICH die gespeicherte `release_id` gelesen.
 *  - KEIN Fallback auf eine andere Revision, eine andere Freigabe, Stammdaten
 *    oder einen Ersatzwert. Fehlt der Wert, gibt es einen klaren
 *    `missing`-Zustand mit Begründung.
 *  - Reine LESEBEZIEHUNG: es wird niemals in `production_releases` oder deren
 *    Nebentabellen zurückgeschrieben.
 *
 * Die bestehende Wertquelle `linked_form` bleibt unverändert; diese Quelle ist
 * eine zusätzliche, additive Art innerhalb des vorhandenen
 * `form_fields.data_source`-Modells.
 */

/** Art der Wertquelle innerhalb von `form_fields.data_source`. */
export const PRODUCTION_RELEASE_SOURCE = "production_release_field" as const;

export interface ProductionReleaseFieldRef {
  /** Konkrete Revision (production_releases.id) – niemals root_release_id. */
  release_id: string;
  /** Feldschlüssel innerhalb der Revision (Spalte oder Schlüssel in form_data). */
  field_key: string;
  /** Anzeigetext für den Designer (rein informativ). */
  label?: string;
}

export type ProductionReleaseResolution =
  | { status: "ok"; value: unknown; unit: string | null; label: string }
  | { status: "missing"; reason: string };

/** Fachliche Einstufung der Quellfelder der m³-Liste. */
export type ReleaseFieldRole = "grey" | "yellow";

export interface ReleaseFieldDefinition {
  key: string;
  label: string;
  unit: string | null;
  /**
   * „grey": wird unverändert aus der Revision übernommen.
   * „yellow": wird vorbelegt und muss in der m³-Liste bestätigt/korrigiert
   * werden – die Korrektur bleibt in der m³-Liste und verändert die
   * Fertigungsfreigabe nicht.
   */
  role: ReleaseFieldRole;
}

/**
 * Katalog der Quellfelder einer Fertigungsfreigabe-Revision. Es werden keine
 * neuen Daten angelegt – alle Einträge verweisen auf bereits vorhandene
 * Spalten von `production_releases`.
 */
export const RELEASE_FIELD_CATALOG: ReleaseFieldDefinition[] = [
  { key: "release_number", label: "Fertigungsfreigabe (Kennung)", unit: null, role: "grey" },
  { key: "revision_number", label: "Revision", unit: null, role: "grey" },
  { key: "revision_date", label: "Revisionsdatum", unit: null, role: "grey" },
  { key: "project_name", label: "Projekt", unit: null, role: "grey" },
  { key: "customer_name", label: "Kunde", unit: null, role: "grey" },
  { key: "end_customer", label: "Endkunde", unit: null, role: "grey" },
  { key: "article_number", label: "Artikelnummer", unit: null, role: "grey" },
  { key: "product_type", label: "Produktart", unit: null, role: "grey" },
  { key: "drawing_approval", label: "Zeichnungsfreigabe", unit: null, role: "grey" },
  { key: "cost_center_code", label: "Kostenstelle", unit: null, role: "grey" },
  { key: "recipe", label: "Rezeptur", unit: null, role: "grey" },
  { key: "piece_count", label: "Liefermenge (Stück)", unit: "Stk", role: "grey" },
  { key: "elements_total", label: "Elemente gesamt", unit: "Stk", role: "grey" },
  { key: "delivery_date", label: "Lieferdatum", unit: null, role: "grey" },
  { key: "completion_date", label: "Fertigstellung", unit: null, role: "grey" },
  { key: "length_mm", label: "Länge", unit: "mm", role: "grey" },
  { key: "cross_section_mm", label: "Querschnitt", unit: "mm", role: "grey" },
  { key: "inner_wall_thickness_mm", label: "Innenwanddicke", unit: "mm", role: "grey" },
  { key: "target_geometry", label: "Zielgeometrie", unit: null, role: "grey" },
  { key: "cell_configuration", label: "Zellkonfiguration", unit: null, role: "grey" },
  { key: "v2o5_percent", label: "V2O5", unit: "%", role: "grey" },

  { key: "normal_modules", label: "Normalmodule", unit: "Stk", role: "yellow" },
  { key: "test_modules", label: "Prüfmodule", unit: "Stk", role: "yellow" },
  { key: "spare_elements", label: "Ersatzelemente", unit: "Stk", role: "yellow" },
  { key: "sample_elements", label: "Probenelemente", unit: "Stk", role: "yellow" },
  { key: "length_tolerance", label: "Längentoleranz", unit: null, role: "yellow" },
  { key: "cross_section_tolerance", label: "Querschnittstoleranz", unit: null, role: "yellow" },
  { key: "inner_wall_tolerance", label: "Innenwandtoleranz", unit: null, role: "yellow" },
  { key: "test_conditions_remarks", label: "Prüfbedingungen (NOx/SOx/Bench/Micro)", unit: null, role: "yellow" },
  { key: "qa_qc_requirements", label: "Laborprüfungen / QA-QC", unit: null, role: "yellow" },
  { key: "sorting_criteria", label: "Sortierkriterien", unit: null, role: "yellow" },
];

export function releaseFieldDefinition(key: string): ReleaseFieldDefinition | null {
  return RELEASE_FIELD_CATALOG.find((f) => f.key === key) ?? null;
}

const METADATA_KEY = "production_release_ref";

/** Liest die Referenz aus einer `data_source` eines Formularfeldes. */
export function readProductionReleaseSource(
  dataSource: unknown
): ProductionReleaseFieldRef | null {
  const ds = dataSource as { source?: Record<string, unknown> } | null;
  const src = ds && typeof ds === "object" ? ds.source : null;
  if (!src || typeof src !== "object") return null;
  if (src.kind !== PRODUCTION_RELEASE_SOURCE) return null;
  if (!src.release_id || !src.field_key) return null;
  return {
    release_id: String(src.release_id),
    field_key: String(src.field_key),
    label: typeof src.label === "string" ? src.label : undefined,
  };
}

/** Baut eine `data_source` für ein Formularfeld (Modus stets lesend). */
export function buildProductionReleaseSource(ref: ProductionReleaseFieldRef) {
  return {
    mode: "copy" as const,
    source: {
      kind: PRODUCTION_RELEASE_SOURCE,
      release_id: ref.release_id,
      field_key: ref.field_key,
      label: ref.label ?? releaseFieldDefinition(ref.field_key)?.label ?? ref.field_key,
    },
  };
}

/** Referenz in beliebigen Metadaten ablegen bzw. entfernen (nicht-destruktiv). */
export function writeProductionReleaseRef(
  metadata: Record<string, unknown> | null | undefined,
  ref: ProductionReleaseFieldRef | null
): Record<string, unknown> {
  const next = { ...(metadata ?? {}) };
  if (ref) next[METADATA_KEY] = ref;
  else delete next[METADATA_KEY];
  return next;
}

export function readProductionReleaseRef(
  metadata: Record<string, unknown> | null | undefined
): ProductionReleaseFieldRef | null {
  const raw = (metadata ?? {})[METADATA_KEY] as Partial<ProductionReleaseFieldRef> | undefined;
  if (!raw || typeof raw !== "object" || !raw.release_id || !raw.field_key) return null;
  return {
    release_id: String(raw.release_id),
    field_key: String(raw.field_key),
    label: typeof raw.label === "string" ? raw.label : undefined,
  };
}

/** Geladene Revision (beliebige Spaltenauswahl von `production_releases`). */
export type ReleaseRecord = Record<string, unknown> & { id?: string };

/**
 * Löst ein Quellfeld gegen GENAU die geladene Revision auf.
 *
 * Die geladene Zeile muss zur gespeicherten `release_id` gehören – wurde eine
 * andere Revision geladen (z. B. die inzwischen aktuelle), gilt das
 * ausdrücklich als Fehlzustand und NICHT als Ersatzwert.
 */
export function resolveProductionReleaseField(
  ref: ProductionReleaseFieldRef,
  release: ReleaseRecord | null | undefined
): ProductionReleaseResolution {
  if (!release) {
    return {
      status: "missing",
      reason: "Die referenzierte Fertigungsfreigabe-Revision wurde nicht gefunden.",
    };
  }
  if (release.id && String(release.id) !== ref.release_id) {
    return {
      status: "missing",
      reason:
        "Es wurde eine andere Revision geladen als in der m³-Liste hinterlegt – es wird kein Ersatzwert verwendet.",
    };
  }
  const def = releaseFieldDefinition(ref.field_key);
  const formData = (release.form_data ?? {}) as Record<string, unknown>;
  const raw = ref.field_key in release ? release[ref.field_key] : formData[ref.field_key];
  const label = def?.label ?? ref.label ?? ref.field_key;
  if (raw === null || raw === undefined || raw === "") {
    return {
      status: "missing",
      reason: `In Rev. ${Number(release.revision_number) || 0} ist für „${label}" kein Wert hinterlegt.`,
    };
  }
  return { status: "ok", value: raw, unit: def?.unit ?? null, label };
}

/* -------------------------------------------------------------
 * Auswahl einer konkreten Revision (Suche)
 * ----------------------------------------------------------- */

export interface ReleaseRevisionOption {
  id: string;
  /** Stammsatz der Fertigungsfreigabe – gruppiert alle Revisionen derselben Freigabe. */
  root_release_id: string | null;
  release_number: string | null;
  revision_number: number | null;
  project_name: string | null;
  customer_name: string | null;
  article_number: string | null;
  order_id: string | null;
  order_number: string | null;
  is_current: boolean | null;
  superseded_at: string | null;
}

/** Eindeutige Bezeichnung eines Treffers, Revision immer sichtbar. */
export function releaseRevisionLabel(o: ReleaseRevisionOption): string {
  const parts = [
    o.project_name?.trim() || null,
    o.article_number?.trim() || o.release_number?.trim() || null,
    `Rev${Number(o.revision_number) || 0}`,
  ].filter(Boolean);
  return parts.join(" – ");
}

/** Zustand der Revision für die Anzeige im Treffer. */
export function releaseRevisionState(o: ReleaseRevisionOption): string {
  if (o.superseded_at) return "historisch";
  if (o.is_current) return "aktuell";
  return "Freigabe ausstehend";
}

/**
 * Flexible Suche über die vorhandenen Daten: Auftrag, Auftragsnummer, Projekt,
 * Kunde, Artikelnummer, Freigabekennung und Revision. Mehrere durch Leerzeichen
 * getrennte Begriffe müssen alle zutreffen („UBE #6 0020-6047").
 */
export function matchesReleaseSearch(o: ReleaseRevisionOption, query: string): boolean {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return true;
  const rev = Number(o.revision_number) || 0;
  const haystack = [
    o.order_number,
    o.release_number,
    o.project_name,
    o.customer_name,
    o.article_number,
    `rev${rev}`,
    `rev. ${rev}`,
    `revision ${rev}`,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((term) => haystack.includes(term));
}

/**
 * Gruppenschlüssel: Alle Revisionen derselben Fertigungsfreigabe teilen den
 * Stammsatz (`root_release_id`). Fällt dieser weg (ältere Datensätze), dient
 * die Freigabekennung, danach die Artikelnummer als Gruppierungsmerkmal.
 */
export function releaseGroupKey(o: ReleaseRevisionOption): string {
  return (
    o.root_release_id ??
    (o.release_number ? `release:${o.release_number}` : null) ??
    (o.article_number ? `article:${o.article_number}` : null) ??
    `single:${o.id}`
  );
}

/**
 * Letzte vorhandene Revision einer Fertigungsfreigabe = höchste
 * Revisionsnummer innerhalb derselben Gruppe. Gleichstand: `is_current`
 * gewinnt. Eine reine Lieferterminänderung erzeugt keine neue Revision und
 * ist hier daher ohne Wirkung.
 */
export function latestRevisionInGroup<T extends ReleaseRevisionOption>(options: T[], ref: T): T {
  const key = releaseGroupKey(ref);
  const group = options.filter((o) => releaseGroupKey(o) === key);
  let best = ref;
  let bestRev = Number(ref.revision_number) || 0;
  for (const o of group) {
    const rev = Number(o.revision_number) || 0;
    if (rev > bestRev || (rev === bestRev && o.is_current && !best.is_current)) {
      best = o;
      bestRev = rev;
    }
  }
  return best;
}
