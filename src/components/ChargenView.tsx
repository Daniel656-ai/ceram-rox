import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import type { BatchKind, UnifiedBatch } from "@/lib/api/batches";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoreHorizontal, FlaskConical, Package, History } from "lucide-react";
import { CreateSampleFromBatchDialog } from "@/components/CreateSampleFromBatchDialog";
import { LinkSampleToBatchDialog } from "@/components/LinkSampleToBatchDialog";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { formatQuantity } from "@/lib/formatQuantity";
import { DataTable, type DataTableColumn } from "@/components/data-table";

type FilterKey = "all" | "raw" | "mixture";

const BATCH_STATUS_ORDER = ["aktiv", "gesperrt", "verbraucht"];
const BATCH_STATUS_LABELS: Record<string, string> = {
  aktiv: "Aktiv",
  gesperrt: "Gesperrt",
  verbraucht: "Verbraucht",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: any }> = {
    aktiv: { label: "Aktiv", variant: "default" },
    gesperrt: { label: "Gesperrt", variant: "destructive" },
    verbraucht: { label: "Verbraucht", variant: "secondary" },
  };
  const cfg = map[status] || { label: status, variant: "outline" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function KindBadge({ kind }: { kind: BatchKind }) {
  return kind === "raw" ? (
    <Badge variant="outline" className="gap-1">
      <Package className="h-3 w-3" /> Rohstoff
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1">
      <FlaskConical className="h-3 w-3" /> Knetung
    </Badge>
  );
}

export function ChargenView() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterKey>("all");

  const [createSampleBatch, setCreateSampleBatch] = useState<UnifiedBatch | null>(null);
  const [linkSampleBatch, setLinkSampleBatch] = useState<UnifiedBatch | null>(null);
  const [linkedSamplesBatch, setLinkedSamplesBatch] = useState<UnifiedBatch | null>(null);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["batches", filter],
    queryFn: () => api.batches.list(filter),
  });

  const linkedSamplesQuery = useQuery({
    queryKey: ["mixture_batch_samples", linkedSamplesBatch?.id],
    queryFn: () => api.batches.samplesForMixtureBatch(linkedSamplesBatch!.id),
    enabled: !!linkedSamplesBatch && linkedSamplesBatch.batch_kind === "mixture",
  });

  const columns = useMemo<DataTableColumn<UnifiedBatch>[]>(
    () => [
      {
        key: "batch_number",
        header: "Chargennr.",
        type: "text",
        className: "font-mono",
      },
      {
        key: "batch_kind",
        header: "Typ",
        type: "status",
        statusOrder: ["mixture", "raw"],
        statusLabels: { mixture: "Knetung", raw: "Rohstoff" },
        cell: (b) => <KindBadge kind={b.batch_kind} />,
      },
      {
        key: "product_name",
        header: "Produkt / Rezeptur",
        type: "text",
        cell: (b) =>
          b.batch_kind === "mixture" && b.source_id ? (
            <Link to={`/mischungen/${b.source_id}`} className="hover:underline">
              {b.product_name}
            </Link>
          ) : b.batch_kind === "raw" && b.source_id ? (
            <Link to={`/rohstoffe/${b.source_id}`} className="hover:underline">
              {b.product_name}
            </Link>
          ) : (
            b.product_name
          ),
      },
      {
        key: "produced_at",
        header: "Datum",
        type: "date",
        cell: (b) =>
          b.produced_at ? format(new Date(b.produced_at), "dd.MM.yyyy", { locale: de }) : "–",
      },
      {
        key: "quantity",
        header: "Menge",
        type: "number",
        headClassName: "text-right",
        className: "text-right tabular-nums",
        cell: (b) =>
          b.quantity != null ? `${formatQuantity(b.quantity)} ${b.unit ?? ""}` : "–",
      },
      {
        key: "expiry_date",
        header: "Verfall",
        type: "date",
        cell: (b) =>
          b.expiry_date ? format(new Date(b.expiry_date), "dd.MM.yyyy", { locale: de }) : "–",
      },
      {
        key: "status",
        header: "Status",
        type: "status",
        statusOrder: BATCH_STATUS_ORDER,
        statusLabels: BATCH_STATUS_LABELS,
        cell: (b) => <StatusBadge status={b.status} />,
      },
      {
        key: "actions",
        header: "",
        type: "custom",
        sortable: false,
        filterable: false,
        searchable: false,
        headClassName: "w-12",
        cell: (b) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {b.batch_kind === "mixture" && (
                <>
                  <DropdownMenuItem onClick={() => setCreateSampleBatch(b)}>
                    Probe erstellen
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLinkSampleBatch(b)}>
                    Bestehende Probe verknüpfen
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLinkedSamplesBatch(b)}>
                    Verknüpfte Proben anzeigen
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => navigate(`/mischungen/${b.source_id}?tab=batches`)}
                  >
                    <History className="mr-2 h-4 w-4" /> Chargenhistorie
                  </DropdownMenuItem>
                </>
              )}
              {b.batch_kind === "raw" && (
                <DropdownMenuItem onClick={() => navigate(`/rohstoffe/${b.source_id}`)}>
                  <History className="mr-2 h-4 w-4" /> Rohstoff öffnen
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [navigate],
  );

  return (
    <div className="space-y-4">
      <DataTable<UnifiedBatch>
        tableId={`chargen.${filter}`}
        columns={columns}
        rows={list as UnifiedBatch[]}
        rowKey={(b) => `${b.batch_kind}-${b.id}`}
        isLoading={isLoading}
        emptyMessage="Keine Chargen gefunden."
        searchPlaceholder="Chargennummer, Produkt …"
        toolbarActions={
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
            <TabsList>
              <TabsTrigger value="all">Alle Chargen</TabsTrigger>
              <TabsTrigger value="mixture">Knetungschargen</TabsTrigger>
              <TabsTrigger value="raw">Rohstoffchargen</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {createSampleBatch && (
        <CreateSampleFromBatchDialog
          open={!!createSampleBatch}
          onOpenChange={(o) => !o && setCreateSampleBatch(null)}
          mixtureBatchId={createSampleBatch.id}
          mixtureBatchNumber={createSampleBatch.batch_number}
          mixtureName={createSampleBatch.product_name}
        />
      )}

      {linkSampleBatch && (
        <LinkSampleToBatchDialog
          open={!!linkSampleBatch}
          onOpenChange={(o) => !o && setLinkSampleBatch(null)}
          mixtureBatchId={linkSampleBatch.id}
          mixtureBatchNumber={linkSampleBatch.batch_number}
        />
      )}

      <Dialog
        open={!!linkedSamplesBatch}
        onOpenChange={(o) => !o && setLinkedSamplesBatch(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Verknüpfte Proben — Charge {linkedSamplesBatch?.batch_number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {linkedSamplesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Lade…</p>
            ) : (linkedSamplesQuery.data as any[])?.length ? (
              <ul className="divide-y rounded-md border">
                {(linkedSamplesQuery.data as any[]).map((s) => (
                  <li key={s.id}>
                    <Link
                      to={`/proben/${s.id}`}
                      className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted"
                    >
                      <span className="font-mono">{s.sample_number}</span>
                      <span className="truncate text-muted-foreground">{s.sample_name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch keine Proben mit dieser Charge verknüpft.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
