import { dbClient } from "./client";
import { unwrap } from "./_helpers";

/**
 * Phase 4: Historisierung von Feldwerten.
 * Speichert je Änderung Benutzer, Zeitpunkt, alten und neuen Wert.
 */

export interface FormValueHistoryEntry {
  id: string;
  order_id: string | null;
  form_definition_id: string | null;
  field_key: string;
  field_label: string | null;
  old_value: unknown;
  new_value: unknown;
  changed_by: string | null;
  changed_at: string;
}

export interface FormValueChange {
  field_key: string;
  field_label?: string | null;
  old_value: unknown;
  new_value: unknown;
}

const equalish = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export const formValueHistory = {
  listForOrder: (orderId: string, opts?: { fieldKey?: string; limit?: number }) => {
    let q = dbClient
      .from("form_value_history" as any)
      .select("*")
      .eq("order_id", orderId)
      .order("changed_at", { ascending: false })
      .limit(opts?.limit ?? 200);
    if (opts?.fieldKey) q = q.eq("field_key", opts.fieldKey);
    return unwrap(q) as unknown as Promise<FormValueHistoryEntry[]>;
  },

  listForField: (fieldKey: string, limit = 100) =>
    unwrap(
      dbClient
        .from("form_value_history" as any)
        .select("*")
        .eq("field_key", fieldKey)
        .order("changed_at", { ascending: false })
        .limit(limit)
    ) as unknown as Promise<FormValueHistoryEntry[]>,

  /**
   * Protokolliert geänderte Werte. Unveränderte Werte werden ignoriert.
   * Fehler beim Protokollieren dürfen den Speichervorgang nicht blockieren.
   */
  async record(params: {
    orderId?: string | null;
    formId?: string | null;
    changes: FormValueChange[];
  }): Promise<void> {
    const rows = (params.changes ?? [])
      .filter((c) => !equalish(c.old_value, c.new_value))
      .map((c) => ({
        order_id: params.orderId ?? null,
        form_definition_id: params.formId ?? null,
        field_key: c.field_key,
        field_label: c.field_label ?? null,
        old_value: (c.old_value ?? null) as any,
        new_value: (c.new_value ?? null) as any,
      }));
    if (rows.length === 0) return;
    const { error } = await dbClient.from("form_value_history" as any).insert(rows as any);
    if (error) console.warn("[formValueHistory] konnte nicht protokolliert werden:", error.message);
  },

  /** Bequemer Diff zweier Wertobjekte. */
  diff(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    labels?: Record<string, string>
  ): FormValueChange[] {
    const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
    const out: FormValueChange[] = [];
    for (const k of keys) {
      if (equalish(before?.[k], after?.[k])) continue;
      out.push({
        field_key: k,
        field_label: labels?.[k] ?? null,
        old_value: before?.[k] ?? null,
        new_value: after?.[k] ?? null,
      });
    }
    return out;
  },
};
