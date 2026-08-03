import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

/**
 * Phase 4: Formularversionierung.
 * Beim Veröffentlichen wird ein vollständiger Snapshot (Formular, Felder,
 * Layout, Rollenansichten, Rechte, Regeln) abgelegt. Aufträge merken sich,
 * mit welcher Version sie erstellt wurden.
 */

export interface FormDefinitionVersion {
  id: string;
  form_definition_id: string;
  version: number;
  note: string | null;
  snapshot: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface OrderFormVersion {
  id: string;
  order_id: string;
  form_definition_id: string;
  version: number;
  version_id: string | null;
  role_key: string | null;
  created_at: string;
}

const table = "form_definition_versions" as any;

export const formVersions = {
  list: (formId: string) =>
    unwrap(
      dbClient
        .from(table)
        .select("*")
        .eq("form_definition_id", formId)
        .order("version", { ascending: false })
    ) as unknown as Promise<FormDefinitionVersion[]>,

  get: (id: string) =>
    unwrap(dbClient.from(table).select("*").eq("id", id).single()) as unknown as Promise<FormDefinitionVersion>,

  /**
   * Erstellt einen Snapshot der aktuellen Formulardefinition und erhöht die
   * Versionsnummer des Formulars.
   */
  async publish(formId: string, note?: string): Promise<FormDefinitionVersion> {
    const [form, fields, roleViews, permissions, rules] = await Promise.all([
      unwrap(dbClient.from("form_definitions" as any).select("*").eq("id", formId).single()) as any,
      unwrap(dbClient.from("form_fields" as any).select("*").eq("form_id", formId)) as any,
      unwrap(dbClient.from("form_role_views" as any).select("*").eq("form_definition_id", formId)) as any,
      unwrap(dbClient.from("form_field_permissions" as any).select("*").eq("form_definition_id", formId)) as any,
      unwrap(dbClient.from("form_field_rules" as any).select("*").eq("form_definition_id", formId)) as any,
    ]);

    const nextVersion = (form?.version ?? 1) + 1;
    const created = (await unwrap(
      dbClient
        .from(table)
        .insert({
          form_definition_id: formId,
          version: nextVersion,
          note: note ?? null,
          snapshot: { form, fields, role_views: roleViews, permissions, rules },
        } as any)
        .select()
        .single()
    )) as unknown as FormDefinitionVersion;

    await run(
      dbClient.from("form_definitions" as any).update({ version: nextVersion } as any).eq("id", formId)
    );
    return created;
  },

  remove: (id: string) => run(dbClient.from(table).delete().eq("id", id)),
};

export const orderFormVersions = {
  listForOrder: (orderId: string) =>
    unwrap(
      dbClient.from("order_form_versions" as any).select("*").eq("order_id", orderId)
    ) as unknown as Promise<OrderFormVersion[]>,

  /** Merkt sich die verwendete Formularversion für einen Auftrag (idempotent). */
  async pin(orderId: string, formId: string, version: number, roleKey?: string) {
    await run(
      dbClient.from("order_form_versions" as any).upsert(
        {
          order_id: orderId,
          form_definition_id: formId,
          version,
          role_key: roleKey ?? null,
        } as any,
        { onConflict: "order_id,form_definition_id" }
      )
    );
  },
};
