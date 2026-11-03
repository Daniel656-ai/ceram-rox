import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ResultRecord } from "@/hooks/useResultsDatabase";
import { resolveRequesterConditions } from "@/lib/results/requesterConditions";
import { useTranslation } from "react-i18next";

const SOURCE_LABEL = {
  result_context: "Am Ergebnis gespeicherter Kontext",
  run_entry: "Durchlauf mit eindeutiger Kennung im Auftragsformular",
  measurement_parameters: "measurement_parameters der ausgewählten Messaufgabe",
} as const;

/** Nicht blockierendes, rein lesendes Seitenpanel für eine Ergebniszeile. */
export default function RequesterConditionsPanel({
  record,
  onClose,
}: {
  record: ResultRecord | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("measurements");
  const res = record ? resolveRequesterConditions(record) : null;
  return (
    <Sheet open={!!record} onOpenChange={(o) => !o && onClose()} modal={false}>
      <SheetContent side="right" className="w-[380px] sm:max-w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Auftraggeber-Vorgaben</SheetTitle>
          {record && (
            <SheetDescription asChild>
              <div className="space-y-0.5 text-xs">
                <div>Auftrag: <span className="font-mono">{record.orderIdentity?.number || record.orderNumber}</span></div>
                <div>Probe: <span className="font-mono">{record.sampleNumber || "–"}</span>{record.sampleName ? ` · ${record.sampleName}` : ""}</div>
                <div>Messung: <span className="font-mono">{record.measurementNumber}</span> · {record.serviceName}</div>
                {record.instanceLabel && <div>Durchlauf: {record.instanceLabel}</div>}
              </div>
            </SheetDescription>
          )}
        </SheetHeader>
        {res && (
          <div className="mt-4 space-y-3 text-sm">
            {res.status !== "unavailable" ? (
              <>
                {res.status === "task_parameters" && <p className="rounded-md border border-dashed px-3 py-2 text-muted-foreground" role="status">{t("requester_task_warning")}</p>}
                <dl className="divide-y rounded-md border">
                  {res.entries.map((e) => (
                    <div key={e.id ?? e.key} className="flex justify-between gap-3 px-3 py-1.5">
                      <dt className="text-muted-foreground">{e.key}</dt>
                      <dd className="font-mono text-right break-words whitespace-pre-wrap">{e.value}{e.unit ? ` ${e.unit}` : ""}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-xs text-muted-foreground">
                  Quelle: {res.sources.map((s) => SOURCE_LABEL[s]).join(" · ")}
                </p>
              </>
            ) : (
              <p className="rounded-md border border-dashed px-3 py-2 text-muted-foreground" role="status">
                Ursprüngliche Auftraggeber-Vorgaben für diesen Messdurchlauf sind nicht eindeutig verfügbar.
              </p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
