/**
 * Fertigungsprojekt eines m³-Beprobungsauftrags (nur lesend).
 *
 * Fertigungsprojekte sind ausschließlich über die Fertigungsfreigabe
 * (production_releases.project_name / customer_name) abgebildet. Die
 * Zuordnung zum Auftrag läuft nur über production_releases.order_id.
 * Projektmanagement-Projekte (public.projects, project_id) werden hier
 * nie verwendet; es gibt keine Namenssuche.
 */
export interface ReleaseProjectRef {
  project_name?: string | null;
  customer_name?: string | null;
}

export interface ProductionProject {
  projectName: string | null;
  customerName: string | null;
  /** Mehrere verknüpfte Freigaben mit unterschiedlichen Angaben → keine Anzeige. */
  ambiguous: boolean;
}

const distinct = (values: (string | null | undefined)[]) =>
  [...new Set(values.map((v) => v?.trim() || "").filter(Boolean))];

/** null = keine Fertigungsfreigabe mit dem Auftrag verknüpft (gewöhnlicher Auftrag). */
export function resolveProductionProject(
  releases: ReleaseProjectRef[] | ReleaseProjectRef | null | undefined
): ProductionProject | null {
  const list = Array.isArray(releases) ? releases : releases ? [releases] : [];
  if (list.length === 0) return null;
  const names = distinct(list.map((r) => r.project_name));
  const customers = distinct(list.map((r) => r.customer_name));
  return {
    projectName: names.length === 1 ? names[0] : null,
    customerName: customers.length === 1 ? customers[0] : null,
    ambiguous: names.length > 1 || customers.length > 1,
  };
}

/** Fertigungsprojekt einer Probe über ihren Auftrag (samples.order_id → Freigabe). */
export function resolveSampleProductionProject(
  sample: { m3_order?: { production_releases?: ReleaseProjectRef[] | null } | null } | null | undefined
): ProductionProject | null {
  return resolveProductionProject(sample?.m3_order?.production_releases ?? null);
}

/**
 * Pflichtdaten der Fertigungsfreigabe vor dem Anlegen eines m³-Beprobungsauftrags.
 * Leere Liste = vollständig. Der Kundenname ist optional.
 */
export function missingSamplingReleaseData(
  rel: Record<string, unknown> | null | undefined,
  articleNumberFallback?: unknown
): string[] {
  const txt = (v: unknown) => (v == null ? "" : String(v).trim());
  if (!rel || !txt(rel.id)) return ["Fertigungsfreigabe"];
  const missing: string[] = [];
  if (!txt(rel.release_number)) missing.push("Freigabenummer");
  if (!txt(rel.article_number) && !txt(articleNumberFallback)) missing.push("Artikelnummer");
  if (!txt(rel.project_name)) missing.push("Fertigungsprojekt (Projektname der Freigabe)");
  return missing;
}
