import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import SampleSelector from "@/components/SampleSelector";
import ReplacementSampleDialog from "@/components/ReplacementSampleDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Replace, History, MapPin } from "lucide-react";
import { toast } from "sonner";

const SAMPLE_STATUS_LABELS: Record<string, string> = {
  neu: "verfügbar",
  eingelagert: "eingelagert",
  in_bearbeitung: "in Bearbeitung",
  teilweise_verbraucht: "teilweise verwendet",
  vollstaendig_verbraucht: "verwendet",
  entsorgt: "entsorgt",
  zurueckgesendet: "zurückgesendet",
};

const GONE_STATES = ["entsorgt", "vollstaendig_verbraucht", "zurueckgesendet"];

function locationLabel(loc: any) {
  if (!loc) return "–";
  return [loc.hall, loc.room, loc.shelf, loc.position].filter(Boolean).join(" / ") || "–";
}

/**
 * Tab „Proben“: alles rund um die physischen Proben eines Auftrags –
 * Zuordnung, Status, Lagerort, Ersatzproben, Entsorgung und Historie.
 */
export default function OrderSamplesTab({
  orderId,
  projectId,
  canEdit,
  canBookReplacement = false,
}: {
  orderId: string;
  projectId?: string;
  canEdit: boolean;
  canBookReplacement?: boolean;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [replaceFor, setReplaceFor] = useState<{ id: string; number: string } | null>(null);

  const { data: links = [] } = useQuery({
    queryKey: ["order-samples", orderId],
    queryFn: () => api.orderSamples.list(orderId) as Promise<any[]>,
    enabled: !!orderId,
  });

  const rows = links as any[];
  const sampleIds = useMemo(() => rows.map((l) => l.sample_id).filter(Boolean), [rows]);

  const { data: history = [] } = useQuery({
    queryKey: ["order-samples-history", orderId, sampleIds.join(",")],
    queryFn: () => api.orderSamples.history(sampleIds) as Promise<any[]>,
    enabled: sampleIds.length > 0,
  });

  const historyBySample = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const h of history as any[]) {
      const arr = m.get(h.sample_id) || [];
      arr.push(h);
      m.set(h.sample_id, arr);
    }
    return m;
  }, [history]);

  const byId = new Map(rows.map((l) => [l.id, l]));
  const originals = rows.filter((l) => !l.is_replacement);
  const selectedIds = originals.map((l) => l.sample_id);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["order-samples", orderId] });
    qc.invalidateQueries({ queryKey: ["order-results-overview", orderId] });
    qc.invalidateQueries({ queryKey: ["order"] });
    qc.invalidateQueries({ queryKey: ["orders"] });
  };

  const handleChange = async (next: string[]) => {
    try {
      const added = next.filter((id) => !selectedIds.includes(id));
      const removed = selectedIds.filter((id) => !next.includes(id));
      const blocked = removed.filter(
        (id) => !!originals.find((l) => l.sample_id === id)?.replaced_by_order_sample_id
      );
      if (blocked.length > 0) {
        toast.error("Proben mit gebuchter Ersatzprobe können nicht entfernt werden");
        return;
      }
      if (added.length > 0) await api.orderSamples.add(orderId, added, user?.id);
      for (const id of removed) await api.orderSamples.remove(orderId, id);
      refresh();
    } catch (e: any) {
      toast.error("Probenzuordnung fehlgeschlagen", { description: e.message });
    }
  };

  const disposalDate = (sampleId: string) => {
    const entries = historyBySample.get(sampleId) || [];
    const hit = entries.find((h) => h.metadata?.new_status === "entsorgt");
    return hit ? new Date(hit.created_at) : null;
  };

  return (
    <div className="space-y-4 pt-4">
      {canEdit && (
        <div className="space-y-1">
          <SampleSelector values={selectedIds} onValuesChange={handleChange} projectId={projectId} />
          <p className="text-xs text-muted-foreground">
            Mehrfachauswahl ist nur bis zur Übergabe an den Messdienstleister möglich.
          </p>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Diesem Auftrag sind keine Proben zugeordnet.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seriennummer</TableHead>
                <TableHead>Bezeichnung</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Lagerort</TableHead>
                <TableHead>Vorhanden</TableHead>
                <TableHead>Ersatzproben-Bezug</TableHead>
                <TableHead className="text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((l) => {
                const s = l.samples || {};
                const replacement = l.replaced_by_order_sample_id
                  ? byId.get(l.replaced_by_order_sample_id)
                  : null;
                const replacedOriginal = l.replaces_order_sample_id
                  ? byId.get(l.replaces_order_sample_id)
                  : null;
                const disposed = s.status === "entsorgt";
                const disposedAt = disposed ? disposalDate(l.sample_id) : null;
                const gone = GONE_STATES.includes(s.status);
                const entries = historyBySample.get(l.sample_id) || [];

                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs align-top">{s.sample_number || "–"}</TableCell>
                    <TableCell className="align-top">
                      <div className="font-medium">{s.sample_name || "–"}</div>
                      {s.description && (
                        <div className="text-xs text-muted-foreground">{s.description}</div>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1 items-start">
                        {replacement ? (
                          <Badge variant="secondary">ersetzt</Badge>
                        ) : (
                          <Badge variant="outline">
                            {SAMPLE_STATUS_LABELS[s.status] || s.status || "–"}
                          </Badge>
                        )}
                        {l.is_replacement && <Badge variant="secondary">Ersatzprobe</Badge>}
                        {disposed && (
                          <span className="text-xs text-muted-foreground">
                            entsorgt{disposedAt ? ` am ${disposedAt.toLocaleDateString("de-AT")}` : ""}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-sm">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {locationLabel(s.storage_locations)}
                      </span>
                    </TableCell>
                    <TableCell className="align-top">
                      {gone ? (
                        <Badge variant="outline" className="text-muted-foreground">nein</Badge>
                      ) : (
                        <Badge variant="outline">ja</Badge>
                      )}
                    </TableCell>
                    <TableCell className="align-top text-sm">
                      {replacement && (
                        <div>
                          Ersatzprobe:{" "}
                          <span className="font-mono text-xs">
                            {replacement.samples?.sample_number}
                          </span>
                        </div>
                      )}
                      {replacedOriginal && (
                        <div>
                          Ersatz für:{" "}
                          <span className="font-mono text-xs">
                            {replacedOriginal.samples?.sample_number}
                          </span>
                        </div>
                      )}
                      {(l.replacement_reason || l.replacement_note) && (
                        <div className="text-xs text-muted-foreground">
                          Grund: {l.replacement_reason}
                          {l.replacement_note ? ` – ${l.replacement_note}` : ""}
                          {l.replaced_at
                            ? ` (${new Date(l.replaced_at).toLocaleString("de-AT")})`
                            : ""}
                        </div>
                      )}
                      {!replacement && !replacedOriginal && (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell className="align-top text-right">
                      <div className="flex justify-end gap-1">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button size="sm" variant="ghost" title="Probenhistorie">
                              <History className="h-3 w-3" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-80 max-h-80 overflow-y-auto">
                            <p className="text-sm font-medium mb-2">Historie {s.sample_number}</p>
                            {entries.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Keine Einträge.</p>
                            ) : (
                              <ul className="space-y-2">
                                {entries.map((h) => (
                                  <li key={h.id} className="text-xs">
                                    <span className="text-muted-foreground">
                                      {new Date(h.created_at).toLocaleString("de-AT")}
                                    </span>{" "}
                                    – {h.action}
                                    {h.metadata?.new_status ? ` → ${SAMPLE_STATUS_LABELS[h.metadata.new_status] || h.metadata.new_status}` : ""}
                                    {h.comment ? ` (${h.comment})` : ""}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </PopoverContent>
                        </Popover>
                        {canBookReplacement && !l.is_replacement && !l.replaced_by_order_sample_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setReplaceFor({ id: l.sample_id, number: s.sample_number || "" })
                            }
                          >
                            <Replace className="h-3 w-3 mr-1" /> Ersatzprobe
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {!canEdit && canBookReplacement && (
        <p className="text-xs text-muted-foreground">
          Die ursprüngliche Probenzuordnung ist schreibgeschützt. Bei Problemen im Labor kann eine
          Ersatzprobe gebucht werden – die ursprüngliche Probe bleibt in der Historie erhalten.
        </p>
      )}

      {replaceFor && (
        <ReplacementSampleDialog
          open={!!replaceFor}
          onOpenChange={(v) => !v && setReplaceFor(null)}
          orderId={orderId}
          projectId={projectId}
          originalSampleId={replaceFor.id}
          originalSampleNumber={replaceFor.number}
        />
      )}
    </div>
  );
}
