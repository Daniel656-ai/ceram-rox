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

export const productionReleases = {
  async list(): Promise<ProductionReleaseRow[]> {
    return (await unwrap(
      db
        .from("production_releases")
        .select(
          "id,status,project_id,project_name,customer_id,customer_name,article_number,completion_date,delivery_date,piece_count,source_type,created_at,updated_at"
        )
        .order("created_at", { ascending: false })
    )) as ProductionReleaseRow[];
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
  async uploadDocument(file: File): Promise<string> {
    const path = `${crypto.randomUUID()}/${file.name}`;
    const { error } = await dbClient.storage.from(BUCKET).upload(path, file);
    if (error) throw error;
    return path;
  },

  async documentUrl(path: string, expiresIn = 600): Promise<string | null> {
    const { data } = await dbClient.storage.from(BUCKET).createSignedUrl(path, expiresIn);
    return data?.signedUrl ?? null;
  },

  /** KI-gestützte Strukturerkennung des PDF-Textes (Edge Function). */
  async analyzePdfText(args: { fileName: string; pages: string[] }): Promise<{
    fields: Record<string, unknown>;
    testParameters: ProductionReleaseTestParameter[];
  }> {
    const { data, error } = await dbClient.functions.invoke("parse-production-release", {
      body: args,
    });
    if (error) throw error;
    return {
      fields: (data?.fields ?? {}) as Record<string, unknown>,
      testParameters: (data?.testParameters ?? []) as ProductionReleaseTestParameter[],
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
