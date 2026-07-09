import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

const BUCKET = "order-reports";

export interface OrderReport {
  id: string;
  order_id: string;
  current_version_no: number;
  auto_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderReportVersion {
  id: string;
  report_id: string;
  version_no: number;
  layout_snapshot: any;
  data_snapshot: any;
  pdf_storage_path: string | null;
  change_reason: string | null;
  generated_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export const orderReports = {
  /** Get (or create if missing) the report row for an order. */
  async getOrCreateForOrder(orderId: string): Promise<OrderReport | null> {
    const existing = (await unwrap(
      dbClient.from("order_reports" as any).select("*").eq("order_id", orderId).maybeSingle()
    )) as unknown as OrderReport | null;
    if (existing) return existing;
    try {
      return (await unwrap(
        dbClient.from("order_reports" as any).insert({ order_id: orderId }).select().single()
      )) as unknown as OrderReport;
    } catch {
      // race condition: another writer inserted; fetch again
      return (await unwrap(
        dbClient.from("order_reports" as any).select("*").eq("order_id", orderId).maybeSingle()
      )) as unknown as OrderReport | null;
    }
  },

  listVersions: (reportId: string) =>
    unwrap(
      dbClient
        .from("order_report_versions" as any)
        .select("*")
        .eq("report_id", reportId)
        .order("version_no", { ascending: false })
    ) as unknown as Promise<OrderReportVersion[]>,

  /**
   * Trigger server-side generation of a new report version.
   * Calls the `generate-order-report` edge function which gathers data,
   * renders a PDF and stores it in the `order-reports` bucket.
   */
  async generate(orderId: string, changeReason?: string): Promise<{ version_no: number; pdf_storage_path: string }> {
    const { data, error } = await dbClient.functions.invoke("generate-order-report", {
      body: { order_id: orderId, change_reason: changeReason ?? null },
    });
    if (error) throw error;
    if (!data?.version_no) throw new Error("Ungültige Antwort der Report-Funktion");
    return data;
  },

  async downloadPdf(path: string): Promise<Blob> {
    const { data, error } = await dbClient.storage.from(BUCKET).download(path);
    if (error) throw error;
    return data;
  },

  async signedPdfUrl(path: string, expiresIn = 300): Promise<string | null> {
    const { data } = await dbClient.storage.from(BUCKET).createSignedUrl(path, expiresIn);
    return data?.signedUrl ?? null;
  },

  approve: (versionId: string, userId: string) =>
    run(
      dbClient
        .from("order_report_versions" as any)
        .update({ approved_by: userId, approved_at: new Date().toISOString() } as any)
        .eq("id", versionId)
    ),

  deleteVersion: (versionId: string) =>
    run(dbClient.from("order_report_versions" as any).delete().eq("id", versionId)),
};
