import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import type { BatchKind, UnifiedBatch } from "@/lib/api/batches";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type FilterKey = "all" | "raw" | "mixture";

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
      <FlaskConical className="h-3 w-3" /> Mischung
    </Badge>
  );
}

export default function ChargenPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const [createSampleBatch, setCreateSampleBatch] = useState<UnifiedBatch | null>(
    null
  );
  const [linkSampleBatch, setLinkSampleBatch] = useState<UnifiedBatch | null>(
    null
  );
  const [linkedSamplesBatch, setLinkedSamplesBatch] = useState<UnifiedBatch | null>(
    null
  );

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["batches", filter],
    queryFn: () => api.batches.list(filter),
  });

  const filtered = (list as UnifiedBatch[]).filter((b) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      b.batch_number?.toLowerCase().includes(q) ||
      b.product_name?.toLowerCase().includes(q)
    );
  });

  const linkedSamplesQuery = useQuery({
    queryKey: ["mixture_batch_samples", linkedSamplesBatch?.id],
    queryFn: () => api.batches.samplesForMixtureBatch(linkedSamplesBatch!.id),
    enabled: !!linkedSamplesBatch && linkedSamplesBatch.batch_kind === "mixture",
  });

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chargen</h1>
          <p className="text-muted-foreground">
            Einheitliche Übersicht über Rohstoff- und Mischungschargen
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle>Chargenübersicht</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Chargennummer oder Produkt…"
              className="w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
            <TabsList>
              <TabsTrigger value="all">Alle Chargen</TabsTrigger>
              <TabsTrigger value="raw">Rohstoffchargen</TabsTrigger>
              <TabsTrigger value="mixture">Mischungschargen</TabsTrigger>
            </TabsList>

            <TabsContent value={filter} className="mt-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chargennr.</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Produkt / Rezeptur</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead className="text-right">Menge</TableHead>
                      <TableHead>Verfall</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                          Lade…
                        </TableCell>
                      </TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                          Keine Chargen gefunden.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((b) => (
                        <TableRow key={`${b.batch_kind}-${b.id}`}>
                          <TableCell className="font-mono">{b.batch_number}</TableCell>
                          <TableCell><KindBadge kind={b.batch_kind} /></TableCell>
                          <TableCell>
                            {b.batch_kind === "mixture" && b.source_id ? (
                              <Link to={`/mischungen/${b.source_id}`} className="hover:underline">
                                {b.product_name}
                              </Link>
                            ) : b.batch_kind === "raw" && b.source_id ? (
                              <Link to={`/rohstoffe/${b.source_id}`} className="hover:underline">
                                {b.product_name}
                              </Link>
                            ) : (
                              b.product_name
                            )}
                          </TableCell>
                          <TableCell>
                            {b.produced_at
                              ? format(new Date(b.produced_at), "dd.MM.yyyy", { locale: de })
                              : "–"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {b.quantity != null ? `${Number(b.quantity).toLocaleString("de-DE")} ${b.unit ?? ""}` : "–"}
                          </TableCell>
                          <TableCell>
                            {b.expiry_date
                              ? format(new Date(b.expiry_date), "dd.MM.yyyy", { locale: de })
                              : "–"}
                          </TableCell>
                          <TableCell><StatusBadge status={b.status} /></TableCell>
                          <TableCell>
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
                                  <DropdownMenuItem
                                    onClick={() => navigate(`/rohstoffe/${b.source_id}`)}
                                  >
                                    <History className="mr-2 h-4 w-4" /> Rohstoff öffnen
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

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
                      <span className="truncate text-muted-foreground">
                        {s.sample_name}
                      </span>
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
