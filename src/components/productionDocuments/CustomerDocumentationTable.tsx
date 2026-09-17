/**
 * Kundendokumentation – eigene Ansicht des Folgeprozesses `documentation`.
 *
 * Die bestehende Anforderungs- und Statuslogik bleibt unverändert; diese
 * Ansicht ergänzt lediglich Darstellung, Vorschau und Export. Sortierung,
 * Suche, Filter und Zurücksetzen verhalten sich wie in der Rohstoffliste
 * (gemeinsame Logik in `src/lib/list/listSorting.ts`).
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, FileDown, RotateCcw, Search, Table2 } from "lucide-react";
import { toast } from "sonner";
import { SortableHead } from "@/components/list/SortableHead";
import { useListSort } from "@/lib/list/listSorting";
import {
  useEnsureCustomerDocumentation,
  useProductionDocumentRequests,
} from "@/hooks/useProductionDocuments";
import { useOrders } from "@/hooks/useOrders";
import {
  DOC_STATUS_COLOR, DOC_STATUS_LABEL, type DocStatus,
} from "@/lib/productionDocuments/requirements";

/** Statuswerte aus der bestehenden Statuslogik – keine eigene Liste. */
const DOC_STATUSES = Object.keys(DOC_STATUS_LABEL) as DocStatus[];
import CustomerDocumentationPreview, {
  useBuiltCustomerDocumentation,
} from "@/components/productionDocuments/CustomerDocumentationPreview";
import { DOC_LANGUAGES, type DocLanguage } from "@/lib/customerDocumentation/i18n";
import {
  downloadCustomerDocumentationCsv,
  exportCustomerDocumentationPdf,
} from "@/lib/customerDocumentation/export";

/* eslint-disable @typescript-eslint/no-explicit-any */

type SortKey = "order" | "customer" | "reference" | "project" | "date" | "status";

const SORT_TYPE: Record<SortKey, "text" | "date"> = {
  order: "text",
  customer: "text",
  reference: "text",
  project: "text",
  date: "date",
  status: "text",
};

interface DocRow {
  id: string;
  orderId: string | null;
  orderNumber: string;
  customer: string;
  reference: string;
  project: string;
  date: string | null;
  status: DocStatus;
}

/** Anzahl der tatsächlich vorhandenen Kapitel – rein lesend ermittelt. */
function ChapterCountCell({ orderId, lang }: { orderId: string | null; lang: DocLanguage }) {
  const { doc, isLoading } = useBuiltCustomerDocumentation(orderId, lang);
  if (!orderId) return <span className="text-muted-foreground">–</span>;
  if (isLoading) return <span className="text-muted-foreground">…</span>;
  return <span className="tabular-nums">{doc?.chapters.length ?? 0}</span>;
}

/** Export-Aktionen einer Zeile – laden die Daten erst bei Bedarf. */
function ExportButtons({
  orderId,
  orderNumber,
  lang,
}: {
  orderId: string | null;
  orderNumber: string;
  lang: DocLanguage;
}) {
  const { t } = useTranslation("customer_documentation");
  const { doc, isLoading } = useBuiltCustomerDocumentation(orderId, lang);
  const base = `Kundendokumentation_${orderNumber || "Auftrag"}_${lang.toUpperCase()}`;

  const pdf = async () => {
    if (!doc) return;
    try {
      await exportCustomerDocumentationPdf({ doc, lang, fileName: `${base}.pdf` });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF-Export fehlgeschlagen");
    }
  };

  const csv = () => {
    if (!doc) return;
    downloadCustomerDocumentationCsv(doc, lang, `${base}.csv`);
  };

  return (
    <>
      <Button variant="ghost" size="sm" disabled={!doc || isLoading} onClick={pdf}>
        <FileDown className="h-4 w-4 mr-1" /> {t("ui.export_pdf")}
      </Button>
      <Button variant="ghost" size="sm" disabled={!doc || isLoading} onClick={csv}>
        <Table2 className="h-4 w-4 mr-1" /> {t("ui.export_csv")}
      </Button>
    </>
  );
}

export default function CustomerDocumentationTable() {
  const navigate = useNavigate();
  const { t } = useTranslation("customer_documentation");
  const { error: syncError } = useEnsureCustomerDocumentation();
  const { data: requests = [], isLoading } = useProductionDocumentRequests({ kind: "documentation" });
  const { data: orders = [] } = useOrders();
  /** Nur zur Hinweisanzeige: gibt es überhaupt zuordenbare Fertigungsfreigaben? */
  const { data: linkedReleases = [], isLoading: releasesLoading } = useQuery({
    queryKey: ["production-releases-with-order"],
    queryFn: () => api.productionDocuments.releasesWithOrder(),
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lang, setLang] = useState<DocLanguage>("de");
  const [previewRow, setPreviewRow] = useState<DocRow | null>(null);
  const sort = useListSort<SortKey>({
    initialKey: "date",
    initialDir: "desc",
    storageKey: "customerDocumentation.listPrefs",
  });

  const orderById = useMemo(() => {
    const map = new Map<string, any>();
    for (const o of orders as any[]) map.set(o.id, o);
    return map;
  }, [orders]);

  const allRows: DocRow[] = useMemo(
    () =>
      (requests as any[]).map((r) => {
        const o = r.order_id ? orderById.get(r.order_id) : null;
        return {
          id: r.id,
          orderId: r.order_id ?? null,
          orderNumber: o?.order_number ?? "",
          customer: o?.customer_name ?? "",
          reference: o?.reference_number ?? "",
          project: [o?.projects?.project_number, o?.projects?.project_name].filter(Boolean).join(" · "),
          date: r.requested_at ?? null,
          status: r.status as DocStatus,
        };
      }),
    [requests, orderById]
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = allRows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.orderNumber, r.customer, r.reference, r.project]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    });
    return sort.sortRows(
      filtered,
      (row, key) =>
        key === "status" ? DOC_STATUS_LABEL[row.status] : (row[key === "order" ? "orderNumber" : key] as unknown),
      (key) => SORT_TYPE[key]
    );
  }, [allRows, search, statusFilter, sort]);

  const filtersActive = !!search || statusFilter !== "all";
  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("ui.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("ui.subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {syncError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Kundendokumentationen konnten nicht automatisch abgeglichen werden: {syncError.message}
          </div>
        )}
        {!releasesLoading && !linkedReleases.length && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
            Keine Fertigungsfreigabe ist einem Auftrag zugeordnet. Die Kundendokumentation entsteht
            automatisch, sobald eine Fertigungsfreigabe einem Auftrag zugeordnet wurde.
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={String(t("ui.search"))}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("ui.all_status")}</SelectItem>
              {DOC_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{DOC_STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={lang} onValueChange={(v) => setLang(v as DocLanguage)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" disabled={!filtersActive} onClick={resetFilters}>
            <RotateCcw className="h-4 w-4 mr-1" /> {t("ui.reset_filters")}
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead columnKey="order" sortKey={sort.sortKey} sortDir={sort.sortDir} onToggle={sort.toggleSort}>
                {t("ui.order")}
              </SortableHead>
              <SortableHead columnKey="customer" sortKey={sort.sortKey} sortDir={sort.sortDir} onToggle={sort.toggleSort}>
                {t("ui.customer")}
              </SortableHead>
              <SortableHead columnKey="reference" sortKey={sort.sortKey} sortDir={sort.sortDir} onToggle={sort.toggleSort}>
                {t("ui.reference")}
              </SortableHead>
              <SortableHead columnKey="project" sortKey={sort.sortKey} sortDir={sort.sortDir} onToggle={sort.toggleSort}>
                {t("ui.project")}
              </SortableHead>
              <SortableHead columnKey="date" sortKey={sort.sortKey} sortDir={sort.sortDir} onToggle={sort.toggleSort}>
                {t("ui.date")}
              </SortableHead>
              <SortableHead columnKey="status" sortKey={sort.sortKey} sortDir={sort.sortDir} onToggle={sort.toggleSort}>
                {t("ui.status")}
              </SortableHead>
              <TableHead className="text-right">{t("ui.chapters")}</TableHead>
              <TableHead className="text-right">{t("ui.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="text-muted-foreground">{t("ui.loading")}</TableCell></TableRow>
            )}
            {!isLoading && !rows.length && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  {t("ui.no_rows")}
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">
                  {r.orderNumber || <span className="text-muted-foreground">nicht zugeordnet</span>}
                </TableCell>
                <TableCell>{r.customer || "–"}</TableCell>
                <TableCell className="font-mono text-xs">{r.reference || "–"}</TableCell>
                <TableCell className="text-sm">{r.project || "–"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.date ? new Date(r.date).toLocaleDateString("de-AT") : "–"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={DOC_STATUS_COLOR[r.status]}>
                    {DOC_STATUS_LABEL[r.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <ChapterCountCell orderId={r.orderId} lang={lang} />
                </TableCell>
                <TableCell className="text-right space-x-1 whitespace-nowrap">
                  <Button variant="secondary" size="sm" disabled={!r.orderId} onClick={() => setPreviewRow(r)}>
                    <Eye className="h-4 w-4 mr-1" /> {t("ui.preview")}
                  </Button>
                  <ExportButtons orderId={r.orderId} orderNumber={r.orderNumber} lang={lang} />
                  {r.orderId && (
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/auftraege/${r.orderId}`)}>
                      {t("ui.open_order")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!previewRow} onOpenChange={(v) => !v && setPreviewRow(null)}>
        <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("ui.title")}</DialogTitle>
            <DialogDescription>{t("ui.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Select value={lang} onValueChange={(v) => setLang(v as DocLanguage)}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {previewRow && (
              <ExportButtons orderId={previewRow.orderId} orderNumber={previewRow.orderNumber} lang={lang} />
            )}
          </div>
          {previewRow && <CustomerDocumentationPreview orderId={previewRow.orderId} lang={lang} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
