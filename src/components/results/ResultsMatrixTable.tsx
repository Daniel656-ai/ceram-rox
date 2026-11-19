import { useMemo, useRef, useState } from "react";
import { ClipboardList } from "lucide-react";
import RequesterConditionsPanel from "@/components/results/RequesterConditionsPanel";
import RichText from "@/components/forms/RichText";
import { HorizontalScrollArea } from "@/components/ui/HorizontalScrollArea";
import { toUnicode } from "@/lib/richText";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { expandByMeasurementInstance, type ResultRecord } from "@/hooks/useResultsDatabase";
import { columnHeader, resultCell, resultForColumn, type ResultParamColumn } from "@/lib/resultSchema";
import { useResultDisplayPrecision } from "@/hooks/useResultDisplayPrecision";
import { formatResultDisplayValue, resolveResultPrecision } from "@/lib/resultDisplayPrecision";
import { useTranslation } from "react-i18next";
import { parseStructuredText } from "@/lib/results/structuredValues";

/**
 * Kompakter, fixierter Identifikationsbereich. Breiten orientieren sich am
 * tatsächlichen Inhalt (Nummern, Kurztexte) – keine überbreiten Spalten.
 */
const ALL_IDENT_COLUMNS = [
  { key: "sample", label: "Probe", width: 104 },
  { key: "order", label: "Auftrag", width: 88 },
  { key: "service", label: "Dienstleistung", width: 112 },
  { key: "analysis", label: "Analyse", width: 92 },
  { key: "date", label: "Datum", width: 64 },
] as const;

type IdentKey = (typeof ALL_IDENT_COLUMNS)[number]["key"];

/**
 * Ergebnismatrix: eine Analyse = eine Zeile, ein Ergebnisparameter = eine Spalte.
 * Die Spaltenstruktur stammt aus der stabilen Ergebnisdefinition und bleibt
 * unabhängig von Filtern erhalten. Identifikationsspalten bleiben beim
 * horizontalen Scrollen fixiert und bilden eine eigene, deckende Ebene.
 */
export default function ResultsMatrixTable({
  records,
  columns,
  showServiceColumn = true,
  onRowClick,
  isRowSelected,
}: {
  records: ResultRecord[];
  columns: ResultParamColumn[];
  /** Bei einer einzelnen Messart überflüssig (überall gleich). */
  showServiceColumn?: boolean;
  /** Klick auf eine Zeile (öffnet die Seitenleiste). */
  onRowClick?: (record: ResultRecord) => void;
  /** Markierung der Zeilen, deren Probe in der Seitenleiste geöffnet ist. */
  isRowSelected?: (record: ResultRecord) => boolean;
}) {
  const { t } = useTranslation("orders");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const precisionDefinitions = useResultDisplayPrecision(records);
  const IDENT_COLUMNS = useMemo(
    () => ALL_IDENT_COLUMNS.filter((c) => showServiceColumn || c.key !== "service"),
    [showServiceColumn],
  );
  const OFFSETS = useMemo(
    () => IDENT_COLUMNS.reduce<number[]>((acc, _c, i) => {
      acc.push(i === 0 ? 0 : acc[i - 1] + IDENT_COLUMNS[i - 1].width);
      return acc;
    }, []),
    [IDENT_COLUMNS],
  );
  const identWidth = IDENT_COLUMNS.reduce((s, c) => s + c.width, 0);
  const identStyle = (key: IdentKey) => {
    const i = IDENT_COLUMNS.findIndex((c) => c.key === key);
    return { left: OFFSETS[i], width: IDENT_COLUMNS[i].width, maxWidth: IDENT_COLUMNS[i].width };
  };

  // Mehrere eigenständige Messungen derselben Tätigkeit (Messdatenblock)
  // erscheinen als eigene, direkt vergleichbare Zeilen.
  const rows = useMemo(() => expandByMeasurementInstance(records), [records]);
  const rowKey = (r: ResultRecord) => `${r.measurementId}:${r.instanceKey ?? ""}`;
  const selected = selectedKey ? rows.find((r) => rowKey(r) === selectedKey) ?? null : null;

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Keine Ergebnisdatensätze gefunden.
      </p>
    );
  }

  return (
    <div className="relative w-full border rounded-md">
      <HorizontalScrollArea scrollContainerRef={scrollContainerRef} viewportClassName="max-h-[70vh]">
        <table className="text-sm border-collapse" style={{ minWidth: identWidth + columns.length * 118 }}>
        <thead>
          <tr>
            {IDENT_COLUMNS.map((c, i) => (
              <th
                key={c.key}
                className="sticky top-0 bg-muted text-left font-medium px-2 py-1.5 text-xs border-b border-r whitespace-nowrap z-40"
                style={{ left: OFFSETS[i], width: c.width, minWidth: c.width, maxWidth: c.width }}
              >
                {c.label}
              </th>
            ))}
            {columns.map((col) => (
              <th
                key={col.key}
                className="sticky top-0 bg-muted text-right text-xs font-medium px-2 py-1.5 border-b align-bottom whitespace-normal break-words leading-tight z-30"
                style={{ minWidth: 110, maxWidth: 200 }}
                title={toUnicode(columnHeader(col))}
              >
                <RichText value={columnHeader(col)} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, rowIdx) => {
            // Deckender Hintergrund: der fixierte Bereich darf niemals die
            // darunter durchscrollenden Ergebniszellen durchscheinen lassen.
            const rowSelected = !!isRowSelected?.(r);
            // Markierte Zeile: deckender Hintergrund auch im fixierten Bereich.
            const rowBg = rowSelected ? "bg-accent" : rowIdx % 2 === 0 ? "bg-background" : "bg-muted/40";
            const stickyBg = rowSelected ? "bg-accent" : rowIdx % 2 === 0 ? "bg-background" : "bg-secondary";
            const stickyCell = `sticky ${stickyBg} px-2 py-0.5 text-xs border-b border-r align-middle z-20`;
            return (
              <tr
                key={`${r.measurementId}:${r.instanceKey ?? ""}`}
                className={`${rowBg}${onRowClick ? " cursor-pointer" : ""}`}
                data-selected-row={rowSelected ? "true" : undefined}
                aria-selected={onRowClick ? rowSelected : undefined}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
              >
                <td
                  className={stickyCell}
                  style={identStyle("sample")}
                >
                  <div
                    title={[
                      r.sampleName,
                      r.originalSampleNumber ? `Ersatzprobe für ${r.originalSampleNumber}` : "",
                    ].filter(Boolean).join(" · ") || undefined}
                  >
                    <span className="font-mono text-xs leading-tight">{r.sampleNumber || "–"}</span>
                    {r.sampleName ? (
                      <div className="text-[10px] leading-tight text-muted-foreground truncate">{r.sampleName}</div>
                    ) : null}
                  </div>
                </td>
                <td
                  className={`${stickyCell} font-mono text-xs`}
                  style={identStyle("order")}
                >
                  <div
                    className="truncate"
                    title={
                      r.orderIdentity?.hasExperimentNumber
                        ? t("technical_number", { number: r.orderNumber })
                        : r.orderIdentity?.missingExperimentNumber
                          ? t("without_experiment_number")
                          : undefined
                    }
                  >
                    {r.orderIdentity?.number || r.orderNumber}
                  </div>
                </td>
                {showServiceColumn && (
                  <td
                    className={stickyCell}
                    style={identStyle("service")}
                  >
                    <div className="truncate" title={r.serviceName}>{r.serviceName}</div>
                  </td>
                )}
                <td
                  className={`${stickyCell} font-mono text-xs`}
                  style={identStyle("analysis")}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span>{r.measurementNumber}</span>
                    <button
                      type="button"
                      className={`rounded p-0.5 hover:bg-accent ${selectedKey === rowKey(r) ? "text-primary" : "text-muted-foreground"}`}
                      aria-label="Auftraggeber-Vorgaben anzeigen"
                      title="Auftraggeber-Vorgaben anzeigen"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedKey(selectedKey === rowKey(r) ? null : rowKey(r));
                      }}
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {r.instanceLabel ? (
                    <div className="font-sans text-[11px] text-muted-foreground truncate" title={r.instanceLabel}>
                      {r.instanceLabel}
                    </div>
                  ) : null}
                </td>
                <td
                  className={`${stickyCell} whitespace-nowrap`}
                  style={identStyle("date")}
                >
                  {r.completedAt ? format(parseISO(r.completedAt), "dd.MM.yy", { locale: de }) : "–"}
                </td>
                {columns.map((col) => {
                  const cell = resultCell(r, col.key);
                  const result = resultForColumn(r, col.key);
                  const precision = result ? resolveResultPrecision(result, r.serviceId, precisionDefinitions) : undefined;
                  // Strukturierter Wert (JSON/Block) nie als Rohtext – Details stehen in der Seitenleiste.
                  const interim = !!result && result.is_official !== true;
                  const structured = cell.value === null && !!cell.text && parseStructuredText(cell.text) !== undefined;
                  return (
                    <td
                      key={col.key}
                      className={`px-2 py-0.5 text-xs border-b text-right tabular-nums font-mono align-middle${interim ? " text-muted-foreground" : ""}`}
                      title={structured ? "Strukturierter Wert – Details in der Seitenleiste" : interim ? "vorläufiger Wert" : undefined}
                    >
                      {structured ? "–" : formatResultDisplayValue(cell.value, cell.text, cell.present, precision)}
                      {interim && !structured && cell.present && <sup className="ml-0.5 font-sans text-[9px]">vorl.</sup>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
        </table>
      </HorizontalScrollArea>
      <RequesterConditionsPanel record={selected} onClose={() => setSelectedKey(null)} />
    </div>
  );
}
