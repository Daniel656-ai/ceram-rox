import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { mapSampleDatabaseRows } from "@/lib/results/sampleDatabaseMapping";
import { buildOrderExport } from "@/lib/orderExport/buildOrderExport";
import { downloadWorkbook } from "@/lib/orderExport/toWorkbook";
import { resultFormId } from "@/lib/resultDisplayPrecision";

/**
 * Excel-Export eines ganzen Auftrags. Lädt die Messungen des Auftrags beim Klick frisch aus der
 * Datenbank (unabhängig von Seitenfiltern), baut die Datei und startet den Download.
 * Nur lesend; Rechte wie beim Ansehen (die Datenbank liefert nur erlaubte Daten).
 */
export function useOrderExcelExport() {
  const { t } = useTranslation(["common", "orders"]);
  const [exporting, setExporting] = useState(false);

  const exportOrder = useCallback(
    async (orderId: string) => {
      if (!orderId || exporting) return;
      setExporting(true);
      try {
        const [measurements, profiles] = await Promise.all([
          api.measurementResults.listSampleDatabaseForOrder(orderId),
          api.measurementResults.listDatabaseProfiles().catch(() => []),
        ]);
        const records = mapSampleDatabaseRows(measurements, profiles);
        if (records.length === 0) {
          toast.error("Für diesen Auftrag liegen keine Ergebnisse zum Exportieren vor.");
          return;
        }
        const serviceIds = Array.from(new Set(records.flatMap((r) => (r.serviceId ? [r.serviceId] : [])))).sort();
        const formIds = Array.from(
          new Set(records.flatMap((r) => r.results.flatMap((o) => resultFormId(o.result_name) ?? []))),
        ).sort();
        const precision = await api.measurementResults.listDisplayPrecisionDefinitions(serviceIds, formIds);

        const first = records[0];
        const status = first.orderStatus ?? "";
        const workflow = first.orderWorkflowStatus ?? "";
        const result = buildOrderExport({
          records,
          statusLabel: status ? t(`common:status_${status}`, { defaultValue: status }) : "",
          workflowLabel: workflow ? t(`orders:workflow.${workflow}`, { defaultValue: workflow }) : null,
          precision,
          exportDate: new Date(),
        });
        if (!result) {
          toast.error("Für diesen Auftrag liegen keine Ergebnisse zum Exportieren vor.");
          return;
        }
        downloadWorkbook(result.sheets, result.fileName);
        toast.success(
          `${result.fileName}: ${result.summary.samples} Probe(n), ${result.summary.services} Messart(en), ${result.summary.values} Werte`,
        );
      } catch (e) {
        toast.error(`Export fehlgeschlagen: ${e instanceof Error ? e.message : "Unbekannter Fehler"}`);
      } finally {
        setExporting(false);
      }
    },
    [exporting, t],
  );

  return { exportOrder, exporting };
}
