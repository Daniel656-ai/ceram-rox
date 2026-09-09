import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import ProductionReleasesPage from "@/pages/ProductionReleasesPage";
import { useProductionDocumentRequests } from "@/hooks/useProductionDocuments";
import { useOrders } from "@/hooks/useOrders";
import {
  DOC_KIND_LABEL, DOC_STATUS_COLOR, DOC_STATUS_LABEL, type DocKind, type DocStatus,
} from "@/lib/productionDocuments/requirements";

/* eslint-disable @typescript-eslint/no-explicit-any */

function FollowUpTable({ kind }: { kind: DocKind }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { data: requests = [], isLoading } = useProductionDocumentRequests({ kind });
  const { data: orders = [] } = useOrders();

  const orderById = useMemo(() => {
    const map = new Map<string, any>();
    for (const o of orders as any[]) map.set(o.id, o);
    return map;
  }, [orders]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (requests as any[]).filter((r) => {
      if (!q) return true;
      const o = orderById.get(r.order_id);
      return String(o?.order_number ?? "").toLowerCase().includes(q);
    });
  }, [requests, search, orderById]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{DOC_KIND_LABEL[kind]}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Auftragsbezogener Folgeprozess – die Anforderung erfolgt direkt im Auftrag unter
          „Fertigungsunterlagen“.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Auftragsnummer suchen"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Auftrag</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Fehlende Daten</TableHead>
              <TableHead>Angefordert</TableHead>
              <TableHead className="text-right">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="text-muted-foreground">Wird geladen …</TableCell></TableRow>
            )}
            {!isLoading && !rows.length && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Noch keine Anforderungen vorhanden.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const o = orderById.get(r.order_id);
              const st = r.status as DocStatus;
              const missing: string[] = Array.isArray(r.missing) ? r.missing : [];
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{o?.order_number ?? r.order_id.slice(0, 8)}</TableCell>
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
                  <TableCell className="text-right">
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
