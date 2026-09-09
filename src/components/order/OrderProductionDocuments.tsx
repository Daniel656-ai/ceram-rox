import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileCheck2, Link2 } from "lucide-react";
import {
  DOC_KIND_LABEL, DOC_STATUS_COLOR, DOC_STATUS_LABEL, evaluateRequirements, nextStatus,
  type DocKind, type DocStatus, type ReleaseLike,
} from "@/lib/productionDocuments/requirements";
import {
  useOrderReleases, useProductionDocumentRequests, useRequestProductionDocument,
  useUpdateProductionDocument, useLinkReleaseToOrder,
} from "@/hooks/useProductionDocuments";

/* eslint-disable @typescript-eslint/no-explicit-any */

const KINDS: DocKind[] = ["m3_list", "documentation"];

export default function OrderProductionDocuments({ order }: { order: any }) {
  const orderId = order?.id as string | undefined;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: releases = [] } = useOrderReleases(orderId);
  const { data: requests = [] } = useProductionDocumentRequests({ orderId });
  const request = useRequestProductionDocument();
  const update = useUpdateProductionDocument();
  const link = useLinkReleaseToOrder();
  const [linkId, setLinkId] = useState("__none__");

  /** Nur aktuell gültige Revision ist Grundlage für Folgeprozesse. */
  const currentRelease = useMemo<ReleaseLike | null>(() => {
    const rows = releases as any[];
    return (rows.find((r) => r.is_current) as ReleaseLike | undefined) ?? (rows[rows.length - 1] as ReleaseLike) ?? null;
  }, [releases]);

  const byKind = (kind: DocKind) => (requests as any[]).find((r) => r.doc_kind === kind) ?? null;
  const statusOf = (kind: DocKind): DocStatus => (byKind(kind)?.status as DocStatus) ?? "nicht_angefordert";

  const evaluations = useMemo(() => {
    const m3 = evaluateRequirements("m3_list", { order, currentRelease });
    const doc = evaluateRequirements("documentation", {
      order, currentRelease, m3Status: statusOf("m3_list"),
    });
    return { m3_list: m3, documentation: doc };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, currentRelease, requests]);

  // Automatische Aktualisierung: eine Anforderung bleibt bestehen und wechselt
  // von „Wartet auf Daten“ auf „Daten vollständig“, sobald alles vorliegt.
  useEffect(() => {
    for (const kind of KINDS) {
      const row = byKind(kind);
      if (!row) continue;
      const ev = evaluations[kind];
      const target = nextStatus(row.status as DocStatus, ev.missing.length);
      const missingChanged = JSON.stringify(row.missing ?? []) !== JSON.stringify(ev.missing);
      const releaseChanged = (row.based_on_release_id ?? null) !== ev.basedOnReleaseId;
      if (target !== row.status || missingChanged || releaseChanged) {
        update.mutate({
          id: row.id, status: target as any, missing: ev.missing, based_on_release_id: ev.basedOnReleaseId,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluations, requests]);

  const { data: allCurrent = [] } = useQuery({
    queryKey: ["production-releases", "current-for-linking"],
    queryFn: () => api.productionReleases.list({ onlyCurrent: true }),
  });

  const onRequest = async (kind: DocKind) => {
    const ev = evaluations[kind];
    try {
      await request.mutateAsync({
        orderId: orderId!,
        kind,
        status: ev.missing.length ? "wartet_auf_daten" : "daten_vollstaendig",
        basedOnReleaseId: ev.basedOnReleaseId,
        missing: ev.missing,
        requestedBy: user?.id ?? null,
      });
      toast.success(
        ev.missing.length
          ? `${DOC_KIND_LABEL[kind]} angefordert – wartet auf Daten.`
          : `${DOC_KIND_LABEL[kind]} angefordert – alle Daten vollständig.`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Anforderung fehlgeschlagen");
    }
  };

  const setStatus = async (kind: DocKind, status: DocStatus) => {
    const row = byKind(kind);
    if (!row) return;
    await update.mutateAsync({
      id: row.id,
      status: status as any,
      completed_at: status === "erstellt" ? new Date().toISOString() : null,
    });
  };

  if (!orderId) return null;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileCheck2 className="h-4 w-4" /> Fertigungsunterlagen
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => navigate("/fertigungsunterlagen")}>
          Bereich öffnen
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unterlage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Grundlage</TableHead>
              <TableHead className="text-right">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Fertigungsfreigabe</TableCell>
              <TableCell>
                {currentRelease ? (
                  <Badge variant="outline">
                    Rev. {Number(currentRelease.revision_number) || 0}
                    {currentRelease.is_current ? " – aktuell" : " – nicht freigegeben"}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">Nicht zugeordnet</span>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs">{(currentRelease as any)?.release_number ?? "–"}</TableCell>
              <TableCell className="text-right">
                {currentRelease ? (
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/fertigungsfreigaben/${currentRelease.id}`)}>
                    Öffnen
                  </Button>
                ) : (
                  "–"
                )}
              </TableCell>
            </TableRow>

            {KINDS.map((kind) => {
              const row = byKind(kind);
              const st = statusOf(kind);
              const ev = evaluations[kind];
              return (
                <TableRow key={kind}>
                  <TableCell className="font-medium">{DOC_KIND_LABEL[kind]}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={DOC_STATUS_COLOR[st]}>{DOC_STATUS_LABEL[st]}</Badge>
                    {st !== "nicht_angefordert" && ev.missing.length > 0 && (
                      <ul className="mt-1 text-xs text-muted-foreground list-disc pl-4">
                        {ev.missing.map((m) => <li key={m}>{m}</li>)}
                      </ul>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{ev.basis}</TableCell>
                  <TableCell className="text-right space-x-2">
                    {!row && (
                      <Button size="sm" onClick={() => onRequest(kind)}>
                        {DOC_KIND_LABEL[kind]} anfordern
                      </Button>
                    )}
                    {row && st === "daten_vollstaendig" && (
                      <Button size="sm" onClick={() => setStatus(kind, "in_erstellung")}>Erstellen</Button>
                    )}
                    {row && st === "in_erstellung" && (
                      <Button size="sm" onClick={() => setStatus(kind, "erstellt")}>Als erstellt markieren</Button>
                    )}
                    {row && st === "erstellt" && <span className="text-xs text-muted-foreground">abgeschlossen</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {!currentRelease && (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={linkId} onValueChange={setLinkId}>
              <SelectTrigger className="w-[320px]">
                <SelectValue placeholder="Fertigungsfreigabe zuordnen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Fertigungsfreigabe wählen</SelectItem>
                {(allCurrent as any[]).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {(r.release_number as string) || r.id.slice(0, 8)} · Rev. {Number(r.revision_number) || 0}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={linkId === "__none__" || link.isPending}
              onClick={async () => {
                await link.mutateAsync({ releaseId: linkId, orderId });
                toast.success("Fertigungsfreigabe dem Auftrag zugeordnet.");
              }}
            >
              <Link2 className="h-4 w-4 mr-2" /> Zuordnen
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
