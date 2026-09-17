/**
 * Vorschau der Kundendokumentation.
 *
 * Reine Anzeige: Es werden keine Daten gespeichert, geändert oder kopiert.
 * Aufbau, Kapitelauswahl und Texte stammen aus derselben Logik wie der Export,
 * damit Vorschau und PDF/CSV identisch sind.
 */
import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCustomerDocumentationSources } from "@/hooks/useCustomerDocumentation";
import { buildCustomerDocumentation, type CustomerDocumentation, type DocField } from "@/lib/customerDocumentation/chapters";
import { docLocale, docT, type DocLanguage } from "@/lib/customerDocumentation/i18n";

export function useBuiltCustomerDocumentation(orderId: string | null | undefined, lang: DocLanguage) {
  const { data, isLoading, error } = useCustomerDocumentationSources(orderId);
  const doc = useMemo<CustomerDocumentation | null>(() => {
    if (!data) return null;
    return buildCustomerDocumentation({ ...data, locale: docLocale(lang) });
  }, [data, lang]);
  return { doc, isLoading, error };
}

export default function CustomerDocumentationPreview({
  orderId,
  lang,
}: {
  orderId: string | null;
  lang: DocLanguage;
}) {
  const { doc, isLoading } = useBuiltCustomerDocumentation(orderId, lang);
  const t = docT(lang);

  const label = (f: DocField) => (f.labelKey ? String(t(`fields.${f.labelKey}`)) : f.label ?? "");

  if (!orderId) {
    return (
      <p className="text-sm text-muted-foreground">
        Diese Kundendokumentation ist keinem Auftrag zugeordnet.
      </p>
    );
  }
  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> {String(t("ui.loading"))}
      </p>
    );
  }
  if (!doc) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">{String(t("document_title"))}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {doc.header.map((f, i) => (
            <div key={i} className="contents">
              <dt className="text-muted-foreground">{label(f)}</dt>
              <dd className="font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {doc.chapters.length === 0 ? (
        <p className="text-sm text-muted-foreground">{String(t("no_content"))}</p>
      ) : (
        <>
          <div>
            <h3 className="font-semibold">{String(t("toc"))}</h3>
            <ol className="mt-2 list-decimal pl-5 text-sm space-y-0.5">
              {doc.chapters.map((c) => (
                <li key={c.key}>{String(t(`chapters.${c.key}`))}</li>
              ))}
            </ol>
          </div>

          {doc.chapters.map((chapter, index) => (
            <section key={chapter.key} className="space-y-3">
              <h3 className="font-semibold">
                {index + 1}. {String(t(`chapters.${chapter.key}`))}
              </h3>

              {chapter.tables.map((table, ti) => (
                <div key={ti} className="space-y-1">
                  {table.title && <p className="text-sm font-medium">{table.title}</p>}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{String(t("table.parameter"))}</TableHead>
                        <TableHead className="text-right">{String(t("table.value"))}</TableHead>
                        <TableHead>{String(t("table.unit"))}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {table.rows.map((row, ri) => (
                        <TableRow key={ri}>
                          <TableCell>{label(row)}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.value}</TableCell>
                          <TableCell className="text-muted-foreground">{row.unit ?? ""}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}

              {chapter.documents.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{String(t("table.document"))}</TableHead>
                      <TableHead>{String(t("table.kind"))}</TableHead>
                      <TableHead>{String(t("table.reference"))}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chapter.documents.map((d, di) => (
                      <TableRow key={di}>
                        <TableCell>{d.name}</TableCell>
                        <TableCell>{String(t(`doc_kinds.${d.kindKey}`))}</TableCell>
                        <TableCell className="text-muted-foreground">{d.reference ?? ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
