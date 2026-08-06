/**
 * Zentrale Systemvariablen (Context Variables) des Prozessmanagers.
 *
 * Idee (Single Source of Truth):
 *   Standardfelder aus Auftrag, Probe, Projekt, Benutzer und Prozess werden
 *   NICHT als Formularfelder dupliziert. Der Prozessmanager lädt den aktuellen
 *   Kontext (siehe `src/lib/api/systemContext.ts`) und stellt ihn allen
 *   Formularen, Berechnungen, Regeln, Berichten und Skripten als
 *   schreibgeschützte Variablen zur Verfügung:
 *
 *     {{auftrag.auftragsnummer}}   {{probe.lotnummer}}   {{projekt.name}}
 *     {{user.name}}                {{prozess.aktueller_schritt}}
 *
 * Erweiterbarkeit:
 *   - Aliase (deutsche Namen) werden hier deklarativ gepflegt.
 *   - ZUSÄTZLICH wird jede Spalte des geladenen Datensatzes automatisch als
 *     Variable bereitgestellt (`auftrag.<spaltenname>`). Neue Standardfelder in
 *     Auftrag/Probe/Projekt sind damit sofort verfügbar, ohne Änderung am
 *     Formulardesigner.
 */

export type SystemNamespace = "auftrag" | "probe" | "projekt" | "user" | "prozess";

export interface SystemContextData {
  auftrag?: Record<string, unknown> | null;
  probe?: Record<string, unknown> | null;
  projekt?: Record<string, unknown> | null;
  user?: Record<string, unknown> | null;
  prozess?: Record<string, unknown> | null;
}

export interface SystemVariable {
  /** Voller Pfad, z.B. "auftrag.auftragsnummer" */
  path: string;
  /** Token für Formulare/Berichte, z.B. "{{auftrag.auftragsnummer}}" */
  token: string;
  namespace: SystemNamespace;
  label: string;
  /** true = deklarierter Alias, false = automatisch aus den Rohdaten abgeleitet */
  curated: boolean;
  value?: unknown;
}

interface AliasDef {
  /** Aliasname innerhalb des Namespace, z.B. "auftragsnummer" */
  name: string;
  label: string;
  /** Quellspalte(n) – die erste vorhandene, nicht leere gewinnt. */
  from: string[];
}

export const SYSTEM_NAMESPACE_LABELS: Record<SystemNamespace, string> = {
  auftrag: "Auftrag",
  probe: "Probe",
  projekt: "Projekt",
  user: "Benutzer",
  prozess: "Prozess",
};

export const SYSTEM_ALIASES: Record<SystemNamespace, AliasDef[]> = {
  auftrag: [
    { name: "id", label: "Auftrags-ID", from: ["id"] },
    { name: "auftragsnummer", label: "Auftragsnummer", from: ["order_number"] },
    { name: "projekt", label: "Projekt (Name)", from: ["project_name"] },
    { name: "projektnummer", label: "Projektnummer", from: ["project_number"] },
    { name: "status", label: "Status", from: ["status"] },
    { name: "workflow_status", label: "Workflow-Status", from: ["workflow_status"] },
    { name: "prioritaet", label: "Priorität", from: ["priority"] },
    { name: "auftraggeber", label: "Auftraggeber", from: ["created_by_name"] },
    { name: "auftragsart", label: "Auftragsart", from: ["order_type"] },
    { name: "auftragskategorie", label: "Auftragskategorie", from: ["order_kind"] },
    { name: "versuchsnummer", label: "Versuchsnummer", from: ["pp_experiment_number"] },
    { name: "kunde", label: "Kunde", from: ["customer_name"] },
    { name: "referenznummer", label: "Referenznummer", from: ["reference_number"] },
    { name: "faelligkeit", label: "Fälligkeit", from: ["due_date"] },
    { name: "erstellt_am", label: "Erstellt am", from: ["created_at"] },
    { name: "notizen", label: "Notizen", from: ["notes"] },
  ],
  probe: [
    { name: "id", label: "Proben-ID", from: ["id"] },
    { name: "probennummer", label: "Probennummer", from: ["sample_number"] },
    { name: "name", label: "Probenname", from: ["sample_name"] },
    { name: "seriennummer", label: "Seriennummer", from: ["serial_number", "reference_number"] },
    { name: "versuchsnummer", label: "Versuchsnummer", from: ["experiment_number"] },
    { name: "lotnummer", label: "Lotnummer", from: ["lot_number"] },
    { name: "bigbagnummer", label: "BigBag-Nummer", from: ["bigbag_number"] },
    { name: "material", label: "Material", from: ["raw_material_code", "category"] },
    { name: "kategorie", label: "Kategorie", from: ["category"] },
    { name: "status", label: "Status", from: ["status"] },
    { name: "tags", label: "Tags", from: ["tags"] },
    { name: "beschreibung", label: "Beschreibung", from: ["description"] },
  ],
  projekt: [
    { name: "id", label: "Projekt-ID", from: ["id"] },
    { name: "name", label: "Projektname", from: ["project_name"] },
    { name: "nummer", label: "Projektnummer", from: ["project_number"] },
    { name: "projektleiter", label: "Projektleiter", from: ["project_manager_name"] },
    { name: "status", label: "Projektstatus", from: ["project_status"] },
    { name: "beschreibung", label: "Beschreibung", from: ["description"] },
  ],
  user: [
    { name: "id", label: "Benutzer-ID", from: ["id"] },
    { name: "name", label: "Name", from: ["full_name"] },
    { name: "email", label: "E-Mail", from: ["email"] },
    { name: "kurzzeichen", label: "Kurzzeichen", from: ["short_code"] },
    { name: "rolle", label: "Rolle", from: ["role"] },
  ],
  prozess: [
    { name: "id", label: "Prozess-ID", from: ["id"] },
    { name: "name", label: "Prozessname", from: ["name"] },
    { name: "status", label: "Prozessstatus", from: ["status"] },
    { name: "aktueller_schritt", label: "Aktueller Schritt", from: ["current_step_name"] },
    { name: "schritt_nummer", label: "Schritt-Nr.", from: ["current_step_index"] },
    { name: "version", label: "Version", from: ["version"] },
  ],
};

const NAMESPACES = Object.keys(SYSTEM_ALIASES) as SystemNamespace[];

function pick(src: Record<string, unknown> | null | undefined, keys: string[]): unknown {
  if (!src) return undefined;
  for (const k of keys) {
    const v = src[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

/**
 * Flacht den Kontext in eine Map `"namespace.variable" -> Wert` ab.
 * Enthält sowohl Aliase als auch alle Rohspalten (automatische Erweiterung).
 */
export function flattenSystemContext(ctx: SystemContextData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const ns of NAMESPACES) {
    const src = (ctx as any)[ns] as Record<string, unknown> | null | undefined;
    if (!src) continue;
    for (const [k, v] of Object.entries(src)) {
      if (v !== null && typeof v === "object" && !Array.isArray(v)) continue;
      out[`${ns}.${k}`] = v;
    }
    for (const a of SYSTEM_ALIASES[ns]) {
      const v = pick(src, a.from);
      if (v !== undefined) out[`${ns}.${a.name}`] = v;
    }
  }
  return out;
}

/** Liste aller aktuell verfügbaren Systemvariablen (für Designer / Auswahl). */
export function listSystemVariables(ctx?: SystemContextData): SystemVariable[] {
  const flat = ctx ? flattenSystemContext(ctx) : {};
  const seen = new Set<string>();
  const vars: SystemVariable[] = [];

  for (const ns of NAMESPACES) {
    for (const a of SYSTEM_ALIASES[ns]) {
      const path = `${ns}.${a.name}`;
      seen.add(path);
      vars.push({
        path,
        token: `{{${path}}}`,
        namespace: ns,
        label: a.label,
        curated: true,
        value: flat[path],
      });
    }
    // automatisch abgeleitete Rohfelder
    for (const path of Object.keys(flat)) {
      if (!path.startsWith(`${ns}.`) || seen.has(path)) continue;
      seen.add(path);
      vars.push({
        path,
        token: `{{${path}}}`,
        namespace: ns,
        label: path.split(".")[1],
        curated: false,
        value: flat[path],
      });
    }
  }
  return vars;
}

export function groupSystemVariables(vars: SystemVariable[]) {
  return NAMESPACES.map((ns) => ({
    namespace: ns,
    label: SYSTEM_NAMESPACE_LABELS[ns],
    items: vars.filter((v) => v.namespace === ns),
  })).filter((g) => g.items.length > 0);
}

/** Prüft, ob ein Pfad eine Systemvariable ist (Namespace-Präfix). */
export function isSystemVariablePath(path: string): boolean {
  const ns = path.split(".")[0] as SystemNamespace;
  return NAMESPACES.includes(ns);
}

/** Löst einen Pfad wie `probe.lotnummer` gegen den Kontext auf. */
export function resolveSystemVariable(path: string, ctx: SystemContextData): unknown {
  return flattenSystemContext(ctx)[path.trim()];
}

export function formatSystemValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (v instanceof Date) return v.toLocaleDateString("de-AT");
  if (typeof v === "boolean") return v ? "Ja" : "Nein";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}(T|$)/.test(v)) {
    const d = new Date(v);
    if (!isNaN(d.getTime())) {
      return v.length > 10 ? d.toLocaleString("de-AT") : d.toLocaleDateString("de-AT");
    }
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

const TOKEN_RE = /\{\{\s*([A-Za-z_][\w.]*)\s*\}\}/g;

/**
 * Ersetzt `{{namespace.variable}}` Tokens in einem Text.
 * Unbekannte Tokens bleiben unverändert stehen, damit andere Binding-Systeme
 * (z.B. Reportbindings) sie weiterverarbeiten können.
 */
export function renderSystemTokens(text: string, flat: Record<string, unknown>): string {
  if (!text || !text.includes("{{")) return text;
  return text.replace(TOKEN_RE, (m, path: string) => {
    if (!isSystemVariablePath(path)) return m;
    if (!(path in flat)) return m;
    return formatSystemValue(flat[path]);
  });
}

/** Enthält der Text mindestens ein Systemvariablen-Token? */
export function containsSystemToken(text?: string | null): boolean {
  if (!text) return false;
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(text))) {
    if (isSystemVariablePath(m[1])) return true;
  }
  return false;
}
