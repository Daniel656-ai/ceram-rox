import type { RenderedReport } from "@/lib/modularReport/build";
import { docT } from "@/lib/customerDocumentation/i18n";

/** HTML-Vorschau derselben Berichtsstruktur, die auch ins PDF geht. */
export function ReportPreview({ report }: { report: RenderedReport }) {
  const t = docT(report.lang);
  return (
    <div className="max-h-[70vh] overflow-auto rounded-md border bg-background p-5 text-sm">
      <h2 className="text-lg font-bold border-b pb-2 mb-4">{report.title}</h2>
      {report.sections.length === 0 && <p className="text-muted-foreground">{String(t("no_content"))}</p>}
      {report.sections.map((s, i) => (
        <section key={s.key} className="mb-5">
          <h3 className="font-semibold mb-2">{i + 1}. {s.heading}</h3>
          {s.fields.length > 0 && (
            <dl className="grid grid-cols-[10rem_1fr] gap-x-3 gap-y-1 mb-2">
              {s.fields.map((f) => (
                <div key={f.label} className="contents">
                  <dt className="font-medium">{f.label}:</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {s.standardText.trim() && <p className="whitespace-pre-wrap mb-2">{s.standardText}</p>}
          {s.orderText.trim() && <p className="whitespace-pre-wrap mb-2">{s.orderText}</p>}
          {s.tables.map((tb, ti) => (
            <div key={ti} className="overflow-x-auto mb-2">
              <table className="w-full text-xs border">
                <thead className="bg-muted/60">
                  <tr>{tb.columns.map((c) => <th key={c} className="px-2 py-1 text-left font-medium">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {tb.rows.map((r, ri) => (
                    <tr key={ri} className="border-t">{r.map((c, ci) => <td key={ci} className="px-2 py-1 align-top">{c}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {s.empty && <p className="text-xs italic text-muted-foreground">{String(t("modular_report.no_data"))}</p>}
        </section>
      ))}
    </div>
  );
}
