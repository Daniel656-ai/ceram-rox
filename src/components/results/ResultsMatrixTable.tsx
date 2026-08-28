import { useMemo } from "react";
import RichText from "@/components/forms/RichText";
import { toUnicode } from "@/lib/richText";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { expandByMeasurementInstance, type ResultRecord } from "@/hooks/useResultsDatabase";
import { columnHeader, resultCell, type ResultParamColumn } from "@/lib/resultSchema";

const IDENT_COLUMNS = [
  { key: "sample", label: "Probe", width: 150 },
  { key: "order", label: "Auftrag", width: 130 },
  { key: "service", label: "Dienstleistung", width: 160 },
  { key: "analysis", label: "Analyse", width: 130 },
  { key: "instance", label: "Messung", width: 150 },
  { key: "date", label: "Datum", width: 100 },
] as const;

const OFFSETS = IDENT_COLUMNS.reduce<number[]>((acc, c, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + IDENT_COLUMNS[i - 1].width);
  return acc;
}, []);

function fmtValue(v: number | null, text: string | null, present: boolean) {
  if (!present) return "";
  if (v !== null) return new Intl.NumberFormat("de-AT", { maximumFractionDigits: 6 }).format(v);
  return text ?? "";
}

/**
 * Ergebnismatrix: eine Analyse = eine Zeile, ein Ergebnisparameter = eine Spalte.
 * Die Spaltenstruktur stammt aus der stabilen Ergebnisdefinition und bleibt
 * unabhängig von Filtern erhalten. Identifikationsspalten bleiben beim
 * horizontalen Scrollen fixiert.
 */
export default function ResultsMatrixTable({
  records,
  columns,
}: {
  records: ResultRecord[];
  columns: ResultParamColumn[];
}) {
  const identWidth = useMemo(
    () => IDENT_COLUMNS.reduce((s, c) => s + c.width, 0),
    []
  );

  // Mehrere eigenständige Messungen derselben Tätigkeit (Messdatenblock)
  // erscheinen als eigene, direkt vergleichbare Zeilen.
  const rows = useMemo(() => expandByMeasurementInstance(records), [records]);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Keine Ergebnisdatensätze gefunden.
      </p>
    );
  }

  return (
    <div className="relative w-full overflow-auto max-h-[70vh] border rounded-md">
      <table className="text-sm border-collapse" style={{ minWidth: identWidth + columns.length * 140 }}>
        <thead className="sticky top-0 z-30">
          <tr className="bg-muted">
            {IDENT_COLUMNS.map((c, i) => (
              <th
                key={c.key}
                className="sticky bg-muted text-left font-medium px-3 py-2 border-b border-r whitespace-nowrap z-20"
                style={{ left: OFFSETS[i], width: c.width, minWidth: c.width }}
              >
                {c.label}
              </th>
            ))}
            {columns.map((col) => (
              <th
                key={col.key}
                className="bg-muted text-right font-medium px-3 py-2 border-b align-bottom whitespace-normal break-words leading-tight"
                style={{ minWidth: 130, maxWidth: 220 }}
                title={toUnicode(columnHeader(col))}
              >
                <RichText value={columnHeader(col)} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.measurementId}:${r.instanceKey ?? ""}`} className="odd:bg-background even:bg-muted/20 hover:bg-accent/30">
              <td
                className="sticky bg-inherit px-3 py-1.5 border-b border-r align-top z-10"
                style={{ left: OFFSETS[0], width: IDENT_COLUMNS[0].width }}
              >
                <span className="font-mono text-xs">{r.sampleNumber || "–"}</span>
                {r.sampleName ? (
                  <div className="text-[11px] text-muted-foreground">{r.sampleName}</div>
                ) : null}
                {r.originalSampleNumber ? (
                  <div className="text-[11px] text-muted-foreground">
                    Ersatzprobe für {r.originalSampleNumber}
                  </div>
                ) : null}
              </td>
              <td
                className="sticky bg-inherit px-3 py-1.5 border-b border-r align-top font-mono text-xs z-10"
                style={{ left: OFFSETS[1], width: IDENT_COLUMNS[1].width }}
              >
                {r.orderNumber}
              </td>
              <td
                className="sticky bg-inherit px-3 py-1.5 border-b border-r align-top z-10"
                style={{ left: OFFSETS[2], width: IDENT_COLUMNS[2].width }}
              >
                {r.serviceName}
              </td>
              <td
                className="sticky bg-inherit px-3 py-1.5 border-b border-r align-top font-mono text-xs z-10"
                style={{ left: OFFSETS[3], width: IDENT_COLUMNS[3].width }}
              >
                {r.measurementNumber}
              </td>
              <td
                className="sticky bg-inherit px-3 py-1.5 border-b border-r align-top z-10"
                style={{ left: OFFSETS[4], width: IDENT_COLUMNS[4].width }}
              >
                {r.instanceLabel ? (
                  <>
                    <span>{r.instanceLabel}</span>
                    {r.instanceContext && Object.keys(r.instanceContext).length > 0 && (
                      <div className="text-[11px] text-muted-foreground">
                        {Object.values(r.instanceContext).filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">–</span>
                )}
              </td>
              <td
                className="sticky bg-inherit px-3 py-1.5 border-b border-r align-top whitespace-nowrap z-10"
                style={{ left: OFFSETS[5], width: IDENT_COLUMNS[5].width }}
              >
                {r.completedAt ? format(parseISO(r.completedAt), "dd.MM.yyyy", { locale: de }) : "–"}
              </td>
              {columns.map((col) => {
                const cell = resultCell(r, col.key);
                return (
                  <td key={col.key} className="px-3 py-1.5 border-b text-right tabular-nums font-mono">
                    {fmtValue(cell.value, cell.text, cell.present)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
