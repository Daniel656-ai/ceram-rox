import { Fragment, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Columns3 } from "lucide-react";
import { HorizontalScrollArea } from "@/components/ui/HorizontalScrollArea";
import {
  buildOrderComparison,
  contextText,
  summarizeRuns,
  type ComparisonColumn,
  type ComparisonRow,
  type ComparisonSection,
  type OrderGroup,
} from "@/lib/results/orderGroups";
import type { SampleGroup } from "@/lib/results/sampleResultsAggregation";
import { formatResultLabel } from "@/lib/resultLabels";
import { InfoHint } from "@/components/results/InfoHint";
import SampleLabel from "@/components/results/SampleLabel";
import ActivityMeasurementView from "@/components/results/ActivityMeasurementView";
import { extractActivity } from "@/lib/results/activityMeasurement";
import OrderExcelExportButton from "@/components/order/OrderExcelExportButton";

const nf = new Intl.NumberFormat("de-AT", { maximumFractionDigits: 6 });
const nfMean = new Intl.NumberFormat("de-AT", { maximumFractionDigits: 4 });
const fmt = (v: number | string) => (typeof v === "number" ? nf.format(v) : v);

/** Werte einer Zelle; vorläufige Werte dezent grau. */
function CellValues({ vals, interim }: { vals: Array<number | string>; interim?: boolean[] }) {
  return (
    <>
      {vals.map((v, i) => (
        <Fragment key={i}>
          {i > 0 && " / "}
          {interim?.[i] ? (
            <span className="text-muted-foreground" title="vorläufiger Wert">
              {fmt(v)}
            </span>
          ) : (
            fmt(v)
          )}
        </Fragment>
      ))}
    </>
  );
}

/** Proben eines Auftrags nebeneinander: je Analyseart eine Tabelle (offizielle und vorläufige Werte), je Durchlauf eine Unterzeile. */
export default function OrderComparisonView({
  order,
  onClose,
  onSelectSample,
}: {
  order: OrderGroup;
  onClose: () => void;
  onSelectSample: (sample: SampleGroup) => void;
}) {
  const sections = useMemo(() => buildOrderComparison(order), [order]);
  // Aktivitätsmessungen: eigene Darstellung je Probe/Messung (Messbedingungen + Temperaturtabelle je Katalysator).
  const activities = useMemo(
    () =>
      order.samples.flatMap((sample) =>
        sample.measurements.flatMap((m) => {
          const { view } = extractActivity(m.results);
          return view ? [{ sample, serviceName: m.serviceName || "Aktivitätsmessung", measurementId: m.measurementId, view }] : [];
        }),
      ),
    [order],
  );
  const activityServices = useMemo(() => new Set(activities.map((a) => a.serviceName)), [activities]);
  const [showMean, setShowMean] = useState(false);
  const anyMultiple = sections.some((s) => s.hasMultipleRuns);
  const meanAvailable = sections.filter((s) => s.hasMultipleRuns).every((s) => s.meanAvailable);
  const meanOn = showMean && meanAvailable;

  return (
    <div className="space-y-3">
      {/* Kopf in einer Zeile: Auftrag · Projekt (nur wenn vorhanden) · Schließen */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Zurück" title="Zurück" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Columns3 className="h-4 w-4 shrink-0" />
          <span className="truncate text-base font-semibold">
            Auftrag <span className="font-mono">{order.displayNumber}</span>
            {order.projectNames.length > 0 && (
              <span className="font-normal text-muted-foreground"> · Projekt {order.projectNames.join(", ")}</span>
            )}
          </span>
          <InfoHint label="Hinweise zur Ergebnisübersicht">
            Je Analyseart eine Tabelle mit den Proben des Auftrags. Offizielle und vorläufige Werte werden gezeigt; vorläufige sind grau, offizielle schwarz.
            Hat eine Probe mehrere Durchläufe, steht jeder in einer eigenen Unterzeile. Klick auf eine Probe
            öffnet ihre Messungen.
          </InfoHint>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <OrderExcelExportButton orderId={order.orderId} label="Excel" />
          {anyMultiple && (
            <label
              className={`flex items-center gap-1.5 text-xs ${meanAvailable ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
              title={
                meanAvailable
                  ? "Je Probe eine Zeile mit dem Mittelwert über die Durchläufe (Einzelwerte im Tooltip). Nur sinnvoll bei Wiederholungen."
                  : "Die Durchläufe unterscheiden sich im Kontext (z. B. Messstelle) – kein Mittelwert möglich."
              }
            >
              <Checkbox checked={meanOn} disabled={!meanAvailable} onCheckedChange={(v) => setShowMean(v === true)} />
              Mittelwert anzeigen
            </label>
          )}
        </div>
      </div>
      {sections.length === 0 && activities.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">Keine Messungen in diesem Auftrag.</p>
      )}
      {sections.map((sec) =>
        sec.columns.length === 0 && activityServices.has(sec.serviceName) ? null : sec.columns.length === 0 ? (
          // Analyse ohne jeden Wert: nur eine kurze Zeile statt einer großen Karte.
          <p
            key={sec.serviceName}
            className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground"
          >
            <span className="font-medium text-foreground">{sec.serviceName}</span> – noch keine Werte
          </p>
        ) : (
          <SectionTable key={sec.serviceName} sec={sec} meanOn={meanOn} onSelectSample={onSelectSample} />
        ),
      )}
      {activities.map((a) => (
        <Card key={a.measurementId}>
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
              {a.serviceName}
              <span className="font-normal text-muted-foreground">·</span>
              <button type="button" className="text-left hover:underline" onClick={() => onSelectSample(a.sample)}>
                <SampleLabel number={a.sample.sampleNumber} name={a.sample.sampleName} />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ActivityMeasurementView view={a.view} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SampleCell({ row, label, first }: { row: ComparisonRow; label: string | null; first: boolean }) {
  return (
    <td className="whitespace-nowrap p-2">
      {first ? (
        <>
          <SampleLabel number={row.sample.sampleNumber} name={row.sample.sampleName} />
          {label && <span className="ml-2 text-xs text-muted-foreground">· {label}</span>}
        </>
      ) : (
        <span className="pl-4 text-xs text-muted-foreground">{label}</span>
      )}
    </td>
  );
}

function SectionTable({
  sec,
  meanOn,
  onSelectSample,
}: {
  sec: ComparisonSection;
  meanOn: boolean;
  onSelectSample: (sample: SampleGroup) => void;
}) {
  const cols: ComparisonColumn[] = sec.columns;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{sec.serviceName}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <HorizontalScrollArea className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left font-medium">Probe</th>
                {cols.map((c) => (
                  <th key={c.key} className="whitespace-nowrap p-2 text-right font-medium">
                    {formatResultLabel(c.label, c.unit)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sec.rows.map((row, i) => {
                const rowKey = `${row.sample.sampleKey}-${i}`;
                // Mittelwert-Ansicht: je Probe mit mehreren Durchläufen genau eine Zeile.
                if (meanOn && row.runs.length > 1) {
                  return (
                    <tr
                      key={rowKey}
                      className="cursor-pointer border-t hover:bg-muted/40"
                      onClick={() => onSelectSample(row.sample)}
                    >
                      <td className="whitespace-nowrap p-2">
                        <SampleLabel number={row.sample.sampleNumber} name={row.sample.sampleName} />
                        <span className="ml-2 text-xs text-muted-foreground">· Ø n={row.runs.length}</span>
                      </td>
                      {cols.map((c) => {
                        const s = summarizeRuns(row, c.key);
                        const tip = s.values.length ? `n=${s.n} · Einzelwerte: ${s.values.map(fmt).join(" / ")}` : undefined;
                        return (
                          <td key={c.key} className="whitespace-nowrap p-2 text-right font-mono" title={tip}>
                            {s.mean !== null ? (
                              nfMean.format(s.mean)
                            ) : s.values.length ? (
                              s.values.map(fmt).join(" / ")
                            ) : (
                              "–"
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                }
                return (
                  <Fragment key={rowKey}>
                    {row.runs.map((run, ri) => (
                      <tr
                        key={run.key}
                        className={`cursor-pointer hover:bg-muted/40 ${ri === 0 ? "border-t" : ""}`}
                        onClick={() => onSelectSample(row.sample)}
                        title={contextText(run.context)}
                      >
                        <SampleCell row={row} label={run.label} first={ri === 0} />
                        {cols.map((c) => {
                          const vals = run.cells[c.key];
                          return (
                            <td key={c.key} className="whitespace-nowrap p-2 text-right font-mono">
                              {vals && vals.length ? <CellValues vals={vals} interim={run.interim[c.key]} /> : "–"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </HorizontalScrollArea>
      </CardContent>
    </Card>
  );
}
