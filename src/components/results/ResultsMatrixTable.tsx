import { useMemo } from "react";
import RichText from "@/components/forms/RichText";
import { toUnicode } from "@/lib/richText";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { expandByMeasurementInstance, type ResultRecord } from "@/hooks/useResultsDatabase";
import { columnHeader, resultCell, type ResultParamColumn } from "@/lib/resultSchema";

/**
 * Kompakter, fixierter Identifikationsbereich. Breiten orientieren sich am
 * tatsächlichen Inhalt (Nummern, Kurztexte) – keine überbreiten Spalten.
 */
const IDENT_COLUMNS = [
  { key: "sample", label: "Probe", width: 116 },
  { key: "order", label: "Auftrag", width: 92 },
  { key: "service", label: "Dienstleistung", width: 132 },
  { key: "analysis", label: "Analyse", width: 96 },
  { key: "date", label: "Datum", width: 84 },
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
 * horizontalen Scrollen fixiert und bilden eine eigene, deckende Ebene.
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
      <table className="text-sm border-collapse" style={{ minWidth: identWidth + columns.length * 130 }}>
        <thead>
          <tr>
            {IDENT_COLUMNS.map((c, i) => (
              <th
                key={c.key}
                className="sticky top-0 bg-muted text-left font-medium px-2 py-2 border-b border-r whitespace-nowrap z-40"
                style={{ left: OFFSETS[i], width: c.width, minWidth: c.width, maxWidth: c.width }}
              >
                {c.label}
              </th>
            ))}
            {columns.map((col) => (
              <th
                key={col.key}
                className="sticky top-0 bg-muted text-right font-medium px-3 py-2 border-b align-bottom whitespace-normal break-words leading-tight z-30"
                style={{ minWidth: 120, maxWidth: 220 }}
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
            const rowBg = rowIdx % 2 === 0 ? "bg-background" : "bg-muted/40";
            const stickyBg = rowIdx % 2 === 0 ? "bg-background" : "bg-secondary";
            const stickyCell = `sticky ${stickyBg} px-2 py-1.5 border-b border-r align-top z-20`;
            return (
              <tr key={`${r.measurementId}:${r.instanceKey ?? ""}`} className={rowBg}>
                <td
                  className={stickyCell}
                  style={{ left: OFFSETS[0], width: IDENT_COLUMNS[0].width, maxWidth: IDENT_COLUMNS[0].width }}
                >
                  <span className="font-mono text-xs">{r.sampleNumber || "–"}</span>
                  {r.sampleName ? (
                    <div className="text-[11px] text-muted-foreground truncate" title={r.sampleName}>{r.sampleName}</div>
                  ) : null}
                  {r.originalSampleNumber ? (
                    <div className="text-[11px] text-muted-foreground truncate">
                      Ersatzprobe für {r.originalSampleNumber}
                    </div>
                  ) : null}
                </td>
                <td
                  className={`${stickyCell} font-mono text-xs`}
                  style={{ left: OFFSETS[1], width: IDENT_COLUMNS[1].width, maxWidth: IDENT_COLUMNS[1].width }}
                >
                  {r.orderNumber}
                </td>
                <td
                  className={stickyCell}
                  style={{ left: OFFSETS[2], width: IDENT_COLUMNS[2].width, maxWidth: IDENT_COLUMNS[2].width }}
                >
                  <div className="truncate" title={r.serviceName}>{r.serviceName}</div>
                </td>
                <td
                  className={`${stickyCell} font-mono text-xs`}
                  style={{ left: OFFSETS[3], width: IDENT_COLUMNS[3].width, maxWidth: IDENT_COLUMNS[3].width }}
                >
                  {r.measurementNumber}
                  {r.instanceLabel ? (
                    <div className="font-sans text-[11px] text-muted-foreground truncate" title={r.instanceLabel}>
                      {r.instanceLabel}
                    </div>
                  ) : null}
                </td>
                <td
                  className={`${stickyCell} whitespace-nowrap`}
                  style={{ left: OFFSETS[4], width: IDENT_COLUMNS[4].width, maxWidth: IDENT_COLUMNS[4].width }}
                >
                  {r.completedAt ? format(parseISO(r.completedAt), "dd.MM.yy", { locale: de }) : "–"}
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
