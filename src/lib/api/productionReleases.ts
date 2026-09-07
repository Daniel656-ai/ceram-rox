/**
 * Domain: Fertigungsfreigaben (+ Kundenstamm-Grundlage).
 *
 * Alle Backendzugriffe für den Bereich „Fertigungsfreigaben" laufen
 * ausschließlich über dieses Modul.
 */
import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

const BUCKET = "production-releases";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = dbClient as any;

export interface ProductionReleaseRow {
  id: string;
  status: string;
  project_id: string | null;
  project_name: string | null;
  customer_id: string | null;
  customer_name: string | null;
  article_number: string | null;
  completion_date: string | null;
  delivery_date: string | null;
  piece_count: number | null;
  form_definition_id: string | null;
  form_data: Record<string, unknown>;
  field_sources: Record<string, unknown>;
  source_type: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface ProductionReleaseTestParameter {
  id?: string;
  release_id?: string;
  section: string;
  section_label?: string | null;
  parameter_key: string;
  parameter_label?: string | null;
  value_num?: number | null;
  value_text?: string | null;
  unit?: string | null;
  sort_order?: number;
  source_type?: string;
}

/** Erkannte Änderung einer Revision (Fall A–D). */
export interface ProductionReleaseChange {
  id?: string;
  release_id?: string;
  scope?: string;
  field_key: string;
  field_label?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  detection: "strikethrough" | "red" | "combined" | "text" | "unknown";
  confidence: "high" | "medium" | "low";
  status: "auto_applied" | "pending" | "accepted" | "corrected" | "dismissed";
  page?: number | null;
  note?: string | null;
  evidence?: Record<string, unknown>;
  resolved_value?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at?: string;
}

/** Verständliche Meldungen aus der strukturierten Fehlerantwort des Importdienstes. */
const IMPORT_ERROR_TEXTS: Record<string, string> = {
  INVALID_PAYLOAD: "Die Datei konnte nicht an die Auswertung übergeben werden.",
  PDF_EMPTY: "Aus dieser Datei konnten weder Text noch Seitenbilder gelesen werden.",
  PDF_PARSE_ERROR: "Die Fertigungsfreigabe konnte nicht gelesen werden.",
  NO_DATA_RECOGNIZED: "In diesem Dokument wurden keine Fertigungsfreigabedaten erkannt.",
  RATE_LIMITED: "Zu viele Importe in kurzer Zeit. Bitte in einer Minute erneut versuchen.",
  PAYMENT_REQUIRED: "Das Kontingent für die Dokumenterkennung ist aufgebraucht.",
  AI_ERROR: "Die Fertigungsfreigabe konnte nicht ausgewertet werden.",
  AI_UNAVAILABLE: "Die Dokumenterkennung ist derzeit nicht erreichbar.",
  CONFIG_MISSING: "Die Dokumenterkennung ist derzeit nicht verfügbar.",
  UNAUTHORIZED: "Die Sitzung ist abgelaufen. Bitte neu anmelden und erneut importieren.",
};

async function toReadableImportError(error: unknown, data: unknown): Promise<Error> {
  let payload = (data ?? null) as { error_code?: string; message?: string } | null;

  // supabase-js liefert bei non-2xx die Original-Response in `context`
  const ctx = (error as { context?: Response } | null)?.context;
  if (!payload?.error_code && ctx && typeof ctx.json === "function") {
    try {
      payload = await ctx.clone().json();
    } catch {
      payload = null;
    }
  }
  const status = ctx?.status;
  const code = payload?.error_code ?? (status === 401 || status === 403 ? "UNAUTHORIZED" : undefined);
  const message =
    (code ? IMPORT_ERROR_TEXTS[code] : undefined) ??
    payload?.message ??
    "Die Fertigungsfreigabe konnte nicht verarbeitet werden. Bitte erneut versuchen.";

  // Technische Details nur im Entwicklerprotokoll
  console.error("[Fertigungsfreigabe-Import]", { status, code, error, payload });
  const err = new Error(message);
  (err as Error & { code?: string }).code = code;
  return err;
}


export const productionReleases = {
  async list(opts: { onlyCurrent?: boolean } = {}): Promise<ProductionReleaseRow[]> {
    let q = db
      .from("production_releases")
      .select(
        "id,status,project_id,project_name,customer_id,customer_name,article_number,completion_date,delivery_date,piece_count,source_type,created_at,updated_at,release_number,revision_number,is_current,import_status,root_release_id"
      )
      .order("created_at", { ascending: false });
    if (opts.onlyCurrent) q = q.eq("is_current", true);
    return (await unwrap(q)) as ProductionReleaseRow[];
  },

  /** Alle Revisionen eines Stammsatzes – älteste zuerst. */
  async revisions(rootId: string): Promise<ProductionReleaseRow[]> {
    return (await unwrap(
      db
        .from("production_releases")
        .select(
          "id,status,revision_number,revision_date,is_current,import_status,source_document_name,source_document_path,imported_at,created_at,release_number"
        )
        .eq("root_release_id", rootId)
        .order("revision_number", { ascending: true })
    )) as ProductionReleaseRow[];
  },

  /**
   * Sucht eine bestehende (aktuelle) Fertigungsfreigabe anhand stabiler
   * Dokumentkennungen. Reihenfolge = Priorität der Merkmale.
   */
  async findExisting(keys: {
    release_number?: string | null;
    article_number?: string | null;
    drawing_approval?: string | null;
    cost_center_code?: string | null;
    project_name?: string | null;
  }): Promise<ProductionReleaseRow | null> {
    const attempts: [string, string][] = [];
    if (keys.release_number?.trim()) attempts.push(["release_number", keys.release_number.trim()]);
    if (keys.article_number?.trim()) attempts.push(["article_number", keys.article_number.trim()]);
    if (keys.drawing_approval?.trim()) attempts.push(["drawing_approval", keys.drawing_approval.trim()]);
    if (keys.cost_center_code?.trim()) attempts.push(["cost_center_code", keys.cost_center_code.trim()]);
    for (const [col, val] of attempts) {
      const rows = (await unwrap(
        db.from("production_releases").select("*").eq("is_current", true).ilike(col, val).limit(2)
      )) as ProductionReleaseRow[];
      if (rows?.length === 1) return rows[0];
    }
    return null;
  },

  async get(id: string): Promise<ProductionReleaseRow> {
    return (await unwrap(
      db.from("production_releases").select("*").eq("id", id).single()
    )) as ProductionReleaseRow;
  },

  async create(values: Record<string, unknown>): Promise<ProductionReleaseRow> {
    return (await unwrap(
      db.from("production_releases").insert(values).select("*").single()
    )) as ProductionReleaseRow;
  },

  async update(id: string, values: Record<string, unknown>): Promise<void> {
    await run(db.from("production_releases").update(values).eq("id", id));
  },

  async remove(id: string): Promise<void> {
    await run(db.from("production_releases").delete().eq("id", id));
  },

  // ---- Erkannte Änderungen / Prüfung ---------------------------------------
  async changes(releaseId: string): Promise<ProductionReleaseChange[]> {
    return (await unwrap(
      db
        .from("production_release_changes")
        .select("*")
        .eq("release_id", releaseId)
        .order("created_at", { ascending: true })
    )) as ProductionReleaseChange[];
  },

  async addChanges(releaseId: string, rows: ProductionReleaseChange[]): Promise<void> {
    if (!rows.length) return;
    await run(
      db
        .from("production_release_changes")
        .insert(rows.map((r) => ({ ...r, id: undefined, release_id: releaseId })))
    );
  },

  async updateChange(id: string, values: Partial<ProductionReleaseChange>): Promise<void> {
    await run(db.from("production_release_changes").update(values).eq("id", id));
  },

  /** Offene Prüfpunkte je Fertigungsfreigabe (für Hinweisbanner/Übersicht). */
  async pendingChangeCounts(releaseIds: string[]): Promise<Record<string, number>> {
    if (!releaseIds.length) return {};
    const rows = (await unwrap(
      db
        .from("production_release_changes")
        .select("release_id")
        .in("release_id", releaseIds)
        .eq("status", "pending")
    )) as { release_id: string }[];
    const out: Record<string, number> = {};
    for (const r of rows ?? []) out[r.release_id] = (out[r.release_id] ?? 0) + 1;
    return out;
  },



  // ---- Prüf- und Messvorgaben (strukturiert) --------------------------------
  async testParameters(releaseId: string): Promise<ProductionReleaseTestParameter[]> {
    return (await unwrap(
      db
        .from("production_release_test_parameters")
        .select("*")
        .eq("release_id", releaseId)
        .order("section")
        .order("sort_order")
    )) as ProductionReleaseTestParameter[];
  },

  async replaceTestParameters(
    releaseId: string,
    rows: ProductionReleaseTestParameter[]
  ): Promise<void> {
    await run(db.from("production_release_test_parameters").delete().eq("release_id", releaseId));
    if (!rows.length) return;
    await run(
      db
        .from("production_release_test_parameters")
        .insert(rows.map((r, i) => ({ ...r, id: undefined, release_id: releaseId, sort_order: r.sort_order ?? i })))
    );
  },

  // ---- PDF-Import ----------------------------------------------------------
  /** Original-PDF unverändert ablegen (wird nie überschrieben). */
  async uploadDocument(file: Blob, fileName?: string): Promise<string> {
    const name = fileName ?? (file as File).name ?? "dokument.pdf";
    const path = `${crypto.randomUUID()}/${name}`;
    const { error } = await dbClient.storage.from(BUCKET).upload(path, file, { upsert: false });
    if (error) throw error;
    return path;
  },

  async documentUrl(path: string, expiresIn = 600): Promise<string | null> {
    const { data } = await dbClient.storage.from(BUCKET).createSignedUrl(path, expiresIn);
    return data?.signedUrl ?? null;
  },

  /**
   * KI-gestützte Strukturerkennung (Edge Function).
   * `pages` = Text inkl. visueller Marker, `pairs` = räumlich zugeordnete
   * alt/neu-Paare, `images` = Seitenbilder für OCR, `existing` = bisheriger Stand.
   */
  async analyzePdfText(args: {
    fileName: string;
    pages: string[];
    pairs?: unknown[];
    images?: string[];
    existing?: Record<string, unknown> | null;
  }): Promise<{
    fields: Record<string, unknown>;
    testParameters: ProductionReleaseTestParameter[];
    document: Record<string, unknown>;
    changes: Record<string, unknown>[];
  }> {
    const { data, error } = await dbClient.functions.invoke("parse-production-release", {
      body: args,
    });
    if (error) throw await toReadableImportError(error, data);
    if (data && data.success === false) throw await toReadableImportError(null, data);
    return {
      fields: (data?.fields ?? {}) as Record<string, unknown>,
      testParameters: (data?.testParameters ?? []) as ProductionReleaseTestParameter[],
      document: (data?.document ?? {}) as Record<string, unknown>,
      changes: (data?.changes ?? []) as Record<string, unknown>[],
    };
  },

  async logImport(args: {
    releaseId: string | null;
    fileName: string;
    storagePath: string | null;
    rawText: string;
    extracted: unknown;
    importedBy: string | null;
  }): Promise<void> {
    await run(
      db.from("production_release_imports").insert({
        release_id: args.releaseId,
        file_name: args.fileName,
        storage_path: args.storagePath,
        raw_text: args.rawText.slice(0, 200000),
        extracted: args.extracted ?? {},
        imported_by: args.importedBy,
      })
    );
  },

  async imports(releaseId: string) {
    return await unwrap(
      db
        .from("production_release_imports")
        .select("id,file_name,storage_path,created_at,imported_by")
        .eq("release_id", releaseId)
        .order("created_at", { ascending: false })
    );
  },

  // ---- Einstellungen (Formularzuordnung) -----------------------------------
  async settings(): Promise<{ default_form_definition_id: string | null } | null> {
    return (await unwrap(
      db.from("production_release_settings").select("*").limit(1).maybeSingle()
    )) as { default_form_definition_id: string | null } | null;
  },

  async setDefaultForm(formDefinitionId: string | null, userId: string | null): Promise<void> {
    await run(
      db
        .from("production_release_settings")
        .upsert({ id: true, default_form_definition_id: formDefinitionId, updated_by: userId })
    );
  },
};

// ---- Kundenstamm (Grundlage für spätere Kundenverwaltung / CRM) -------------
export interface CustomerRow {
  id: string;
  customer_number: string | null;
  name: string;
  city: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  is_active: boolean;
}

export const customers = {
  async list(): Promise<CustomerRow[]> {
    return (await unwrap(
      db.from("customers").select("*").order("name")
    )) as CustomerRow[];
  },

  async create(values: Partial<CustomerRow> & { name: string }): Promise<CustomerRow> {
    return (await unwrap(
      db.from("customers").insert(values).select("*").single()
    )) as CustomerRow;
  },

  async update(id: string, values: Partial<CustomerRow>): Promise<void> {
    await run(db.from("customers").update(values).eq("id", id));
  },

  /**
   * Ordnet einen erkannten Kundennamen einem bestehenden Kunden zu
   * (Groß-/Kleinschreibung und Leerzeichen tolerant). Gibt `null` zurück,
   * wenn kein Treffer existiert – der Import darf deswegen nie scheitern.
   */
  async matchByName(name: string): Promise<CustomerRow | null> {
    const cleaned = name.trim();
    if (!cleaned) return null;
    const rows = (await unwrap(
      db.from("customers").select("*").ilike("name", cleaned).limit(1)
    )) as CustomerRow[];
    return rows?.[0] ?? null;
  },

  async contacts(customerId: string) {
    return await unwrap(
      db.from("customer_contacts").select("*").eq("customer_id", customerId).order("name")
    );
  },
};
