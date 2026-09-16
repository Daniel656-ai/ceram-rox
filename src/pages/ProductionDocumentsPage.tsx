import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import ProductionReleasesPage from "@/pages/ProductionReleasesPage";
import ReleaseRevisionPicker, { useReleaseRevisionList } from "@/components/productionDocuments/ReleaseRevisionPicker";
import ReleaseSourceValues from "@/components/productionDocuments/ReleaseSourceValues";
import { useAuth } from "@/contexts/AuthContext";
import { useProductionDocumentRequests, useRequestProductionDocument } from "@/hooks/useProductionDocuments";
import { useOrders } from "@/hooks/useOrders";
import { latestRevisionInGroup, releaseRevisionLabel, type ReleaseRevisionOption } from "@/lib/productionReleaseRef";
import {
  DOC_KIND_LABEL, DOC_STATUS_COLOR, DOC_STATUS_LABEL, type DocKind, type DocStatus,
} from "@/lib/productionDocuments/requirements";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Neue m³-Liste: Der Mitarbeiter wählt eine konkrete Fertigungsfreigabe-Revision
 * aus. Gespeichert wird deren konkrete `production_releases.id` in
 * `production_document_requests.based_on_release_id` (bestehende Struktur).
 */
function NewM3Dialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const request = useRequestProductionDocument();
  const options = useReleaseRevisionList();
  const [selected, setSelected] = useState<ReleaseRevisionOption | null>(null);
  const [autoSuggested, setAutoSuggested] = useState(false);

  // Fachlicher Standard: Bei der Erstellung wird immer die letzte vorhandene
  // Revision der Fertigungsfreigabe vorgeschlagen. Wählt der Mitarbeiter eine
  // ältere Revision, wird auf die letzte umgestellt und dies sichtbar gemacht –
  // eine bewusste Auswahl einer älteren Revision bleibt über die Suche möglich.
  const handleSelect = (o: ReleaseRevisionOption | null) => {
    if (!o) {
      setSelected(null);
      setAutoSuggested(false);
      return;
    }
    const latest = latestRevisionInGroup(options, o);
    setSelected(latest);
    setAutoSuggested(latest.id !== o.id);
  };

  const create = async () => {
    if (!selected) return;
    if (!selected.order_id) {
      toast.error("Diese Fertigungsfreigabe ist noch keinem Auftrag zugeordnet.");
      return;
    }
    try {
      await request.mutateAsync({
        orderId: selected.order_id,
        kind: "m3_list",
        status: "angefordert",
        basedOnReleaseId: selected.id,
        missing: [],
        requestedBy: user?.id ?? null,
      });
      toast.success(`m³-Liste erstellt – Quelle: ${releaseRevisionLabel(selected)}`);
      onOpenChange(false);
      setSelected(null);
      setAutoSuggested(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "m³-Liste konnte nicht erstellt werden.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Neue m³-Liste</DialogTitle>
          <DialogDescription>
            Die m³-Liste wird dauerhaft mit genau dieser Fertigungsfreigabe-Revision verbunden. Eine später
            importierte Revision verändert diese m³-Liste nicht.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <ReleaseRevisionPicker value={selected?.id ?? null} onChange={handleSelect} />
          {autoSuggested && selected && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Es wurde automatisch die letzte vorhandene Revision ({`Rev${Number(selected.revision_number) || 0}`})
              vorgeschlagen. Bei Bedarf kann über die Suche bewusst eine ältere Revision gewählt werden.
            </div>
          )}
          {selected && (
            <div className="rounded-md border p-3 text-sm space-y-1">
              <div className="font-medium">{releaseRevisionLabel(selected)}</div>
              <div className="text-muted-foreground text-xs">
                Auftrag: {selected.order_number ?? (selected.order_id ? selected.order_id.slice(0, 8) : "nicht zugeordnet")}
                {" · "}Kunde: {selected.customer_name ?? "–"}
                {" · "}Kennung: {selected.release_number ?? "–"}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={create} disabled={!selected || request.isPending}>m³-Liste erstellen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FollowUpTable({ kind }: { kind: DocKind }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const { data: requests = [], isLoading } = useProductionDocumentRequests({ kind });
  const { data: orders = [] } = useOrders();
  const releases = useReleaseRevisionList();
  const isM3 = kind === "m3_list";

  const orderById = useMemo(() => {
    const map = new Map<string, any>();
    for (const o of orders as any[]) map.set(o.id, o);
    return map;
  }, [orders]);

  const releaseById = useMemo(() => {
    const map = new Map<string, ReleaseRevisionOption>();
    for (const r of releases) map.set(r.id, r);
    return map;
  }, [releases]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (requests as any[]).filter((r) => {
      if (!q) return true;
      const o = orderById.get(r.order_id);
      const rel = r.based_on_release_id ? releaseById.get(r.based_on_release_id) : null;
      const hay = [o?.order_number, rel ? releaseRevisionLabel(rel) : null, rel?.customer_name]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [requests, search, orderById, releaseById]);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">{DOC_KIND_LABEL[kind]}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {isM3
              ? "Jede m³-Liste verweist dauerhaft auf genau eine Fertigungsfreigabe-Revision."
              : "Auftragsbezogener Folgeprozess – die Anforderung erfolgt direkt im Auftrag unter „Fertigungsunterlagen“."}
          </p>
        </div>
        {isM3 && (
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Neue m³-Liste
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={isM3 ? "Auftrag, Projekt, Kunde, Artikelnummer …" : "Auftragsnummer suchen"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Auftrag</TableHead>
              {isM3 && <TableHead>Quelle (Fertigungsfreigabe / Revision)</TableHead>}
              <TableHead>Status</TableHead>
              <TableHead>Fehlende Daten</TableHead>
              <TableHead>Angefordert</TableHead>
              <TableHead className="text-right">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={isM3 ? 6 : 5} className="text-muted-foreground">Wird geladen …</TableCell></TableRow>
            )}
            {!isLoading && !rows.length && (
              <TableRow>
                <TableCell colSpan={isM3 ? 6 : 5} className="text-center text-muted-foreground py-8">
                  Noch keine Anforderungen vorhanden.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const o = orderById.get(r.order_id);
              const st = r.status as DocStatus;
              const missing: string[] = Array.isArray(r.missing) ? r.missing : [];
              const rel = r.based_on_release_id ? releaseById.get(r.based_on_release_id) : null;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{o?.order_number ?? r.order_id.slice(0, 8)}</TableCell>
                  {isM3 && (
                    <TableCell className="text-xs">
                      {rel ? (
                        <span>
                          {releaseRevisionLabel(rel)}
                          <span className="text-muted-foreground"> · {rel.release_number ?? "–"}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Keine Revision hinterlegt</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant="outline" className={DOC_STATUS_COLOR[st]}>{DOC_STATUS_LABEL[st]}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {missing.length ? (
                      <ul className="list-disc pl-4">{missing.map((m) => <li key={m}>{m}</li>)}</ul>
                    ) : "–"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(r.requested_at).toLocaleDateString("de-AT")}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {isM3 && r.based_on_release_id && (
                      <Button variant="ghost" size="sm" onClick={() => setSourceId(r.based_on_release_id)}>
                        Quellwerte
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/auftraege/${r.order_id}`)}>
                      Auftrag öffnen
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      {isM3 && <NewM3Dialog open={newOpen} onOpenChange={setNewOpen} />}
      <Dialog open={!!sourceId} onOpenChange={(v) => !v && setSourceId(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quellwerte der m³-Liste</DialogTitle>
            <DialogDescription>
              Alle Werte stammen ausschließlich aus der hinterlegten Revision. Es wird nichts in die
              Fertigungsfreigabe zurückgeschrieben.
            </DialogDescription>
          </DialogHeader>
          <ReleaseSourceValues releaseId={sourceId} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function ProductionDocumentsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "freigaben";

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fertigungsunterlagen</h1>
        <p className="text-sm text-muted-foreground">
          Zentrale Übersicht aller auftragsbezogenen Fertigungsunterlagen und Folgeprozesse.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList>
          <TabsTrigger value="freigaben">Fertigungsfreigaben</TabsTrigger>
          <TabsTrigger value="m3">m³-Liste</TabsTrigger>
          <TabsTrigger value="dokumentation">Dokumentation</TabsTrigger>
        </TabsList>

        <TabsContent value="freigaben" className="mt-4">
          {/* Bestehende Fertigungsfreigabe-Funktion unverändert eingebunden. */}
          <div className="-m-6">
            <ProductionReleasesPage />
          </div>
        </TabsContent>

        <TabsContent value="m3" className="mt-4">
          <FollowUpTable kind="m3_list" />
        </TabsContent>

        <TabsContent value="dokumentation" className="mt-4">
          <FollowUpTable kind="documentation" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
