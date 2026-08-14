import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import SampleSelector from "@/components/SampleSelector";
import ReplacementSampleDialog from "@/components/ReplacementSampleDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Replace } from "lucide-react";
import { toast } from "sonner";

/**
 * Probenzuordnung eines Auftrags.
 *
 * - Mehrfachauswahl nur bei Auftragserstellung/-bearbeitung (`canEdit`).
 * - Messdienstleister sehen die ursprüngliche Zuordnung schreibgeschützt und
 *   dürfen ausschließlich eine Ersatzprobe buchen (`canBookReplacement`).
 */
export default function OrderSamplesCard({
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
      const blocked = removed.filter((id) => {
        const link = originals.find((l) => l.sample_id === id);
        return !!link?.replaced_by_order_sample_id;
      });
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

  const renderLine = (l: any) => {
    const replacement = l.replaced_by_order_sample_id ? byId.get(l.replaced_by_order_sample_id) : null;
    const replacedOriginal = l.replaces_order_sample_id ? byId.get(l.replaces_order_sample_id) : null;
    return (
      <li key={l.id} className="flex flex-wrap items-center gap-2 border-b py-2 last:border-0">
        <span className="font-mono text-xs">{l.samples?.sample_number}</span>
        <span className="text-sm">{l.samples?.sample_name}</span>
        {l.is_replacement ? (
          <Badge variant="secondary">
            Ersatzprobe für {replacedOriginal?.samples?.sample_number ?? "–"}
          </Badge>
        ) : (
          <Badge variant="outline">ursprünglich zugeordnet</Badge>
        )}
        {replacement && (
          <Badge variant="secondary">
            ersetzt durch {replacement.samples?.sample_number}
          </Badge>
        )}
        {(l.replacement_reason || l.replacement_note) && (
          <span className="text-xs text-muted-foreground">
            {l.replacement_reason}
            {l.replacement_note ? ` – ${l.replacement_note}` : ""}
            {l.replaced_at ? ` (${new Date(l.replaced_at).toLocaleString("de-AT")})` : ""}
          </span>
        )}
        {canBookReplacement && !l.is_replacement && !l.replaced_by_order_sample_id && (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => setReplaceFor({ id: l.sample_id, number: l.samples?.sample_number || "" })}
          >
            <Replace className="h-3 w-3 mr-1" />
            Ersatzprobe buchen
          </Button>
        )}
      </li>
    );
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Proben</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {canEdit && (
          <SampleSelector values={selectedIds} onValuesChange={handleChange} projectId={projectId} />
        )}
        <ul className="text-sm">
          {rows.map(renderLine)}
          {rows.length === 0 && <li className="text-muted-foreground">Keine Proben zugeordnet</li>}
        </ul>
        {!canEdit && canBookReplacement && (
          <p className="text-xs text-muted-foreground">
            Die ursprüngliche Probenzuordnung ist schreibgeschützt. Bei Problemen im Labor kann eine
            Ersatzprobe gebucht werden.
          </p>
        )}
      </CardContent>

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
    </Card>
  );
}
