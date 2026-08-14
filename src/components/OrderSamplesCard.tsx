import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import SampleSelector from "@/components/SampleSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

/**
 * Bestehende Probenzuordnung eines Auftrags – als Mehrfachauswahl.
 * Nutzt dieselbe Auswahlkomponente wie die Auftragserstellung.
 */
export default function OrderSamplesCard({
  orderId,
  projectId,
  canEdit,
}: {
  orderId: string;
  projectId?: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: links = [] } = useQuery({
    queryKey: ["order-samples", orderId],
    queryFn: () => api.orderSamples.list(orderId) as Promise<any[]>,
    enabled: !!orderId,
  });

  const selectedIds = (links as any[]).map((l) => l.sample_id);

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
      if (added.length > 0) await api.orderSamples.add(orderId, added, user?.id);
      for (const id of removed) await api.orderSamples.remove(orderId, id);
      refresh();
    } catch (e: any) {
      toast.error("Probenzuordnung fehlgeschlagen", { description: e.message });
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Proben</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {canEdit ? (
          <SampleSelector values={selectedIds} onValuesChange={handleChange} projectId={projectId} />
        ) : (
          <ul className="text-sm space-y-1">
            {(links as any[]).map((l) => (
              <li key={l.id}>
                <span className="font-mono text-xs mr-2">{l.samples?.sample_number}</span>
                {l.samples?.sample_name}
              </li>
            ))}
            {links.length === 0 && <li className="text-muted-foreground">Keine Proben zugeordnet</li>}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
