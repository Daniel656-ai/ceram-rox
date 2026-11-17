import { describeOrderAttachments, type OrderDeleteSummary } from "@/lib/orders/orderDeleteSummary";

/** Antwort der Datenbankfunktion `m3_list_delete_plan`. */
export interface M3DeletePlan {
  order_id: string | null;
  order_number?: string | null;
  /** Gesetzt = Löschen nicht möglich (Grund im Klartext). */
  blocked_reason: string | null;
  has_results: boolean;
  samples: { name: string | null; deletable: boolean; reason: string | null }[];
  attachments: Partial<OrderDeleteSummary>;
}

/** Antwort der Datenbankfunktion `delete_m3_list`. */
export interface M3DeleteResult {
  order_deleted: boolean;
  order_number?: string | null;
  deleted_samples: string[];
  kept_samples: { name: string | null; reason: string | null }[];
}

/** Darf der Benutzer die m³-Liste löschen? (Oberfläche; verbindlich prüft die Datenbank.) */
export function canDeleteM3(
  row: { requested_by?: string | null },
  user: { id?: string | null } | null | undefined,
  role: string | null | undefined
): boolean {
  if (role === "master") return true;
  return !!user?.id && !!row.requested_by && row.requested_by === user.id;
}

export interface M3DeleteLine {
  kind: "info" | "delete" | "keep";
  text: string;
}

/** Zeilen für den Dialog: was wird mitgelöscht, was bleibt stehen. */
export function describeM3Delete(plan: M3DeletePlan | null | undefined): M3DeleteLine[] {
  if (!plan) return [];
  const lines: M3DeleteLine[] = [];
  if (plan.order_id) {
    const number = plan.order_number ? ` ${plan.order_number}` : "";
    lines.push({ kind: "delete", text: `Beprobungsauftrag${number} (offen, ohne Messergebnisse)` });
    for (const a of describeOrderAttachments(plan.attachments)) lines.push({ kind: "delete", text: a });
    const del = plan.samples.filter((s) => s.deletable);
    if (del.length) {
      lines.push({ kind: "delete", text: `${del.length} Probe(n) aus der m³-Liste: ${del.map((s) => s.name ?? "ohne Namen").join(", ")}` });
    }
    for (const s of plan.samples.filter((x) => !x.deletable)) {
      lines.push({ kind: "keep", text: `Probe ${s.name ?? "ohne Namen"} bleibt bestehen (${s.reason ?? "wird anderweitig verwendet"})` });
    }
  }
  lines.push({ kind: "info", text: "Die Fertigungsfreigabe bleibt immer erhalten." });
  return lines;
}
