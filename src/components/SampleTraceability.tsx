import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch } from "lucide-react";
import { format } from "date-fns";

interface Props {
  sampleId: string;
}

/**
 * Shows full origin of a sample: mixture batch + recipe + consumed raw material batches.
 * Renders nothing if the sample has no mixture_batch_id.
 */
export function SampleTraceability({ sampleId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["sample_traceability", sampleId],
    queryFn: () => api.mixtureTraceability.forSample(sampleId),
    enabled: !!sampleId,
  });

  if (isLoading || !data || !data.mixture_batch) return null;

  const batch = data.mixture_batch;
  const mixture = data.mixture;
  const recipe = data.recipe || [];
  const consumed = data.consumed_raw_materials || [];

  const producer = batch.producer_first_name
    ? `${batch.producer_first_name} ${batch.producer_last_name || ""}`.trim()
    : "—";

  return (
    <Card className="border-primary/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          Rückverfolgbarkeit / Herkunft
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* Batch info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Herstellungscharge</div>
            <Link
              to={`/mischungen/${mixture?.id ?? ""}`}
              className="font-mono font-medium hover:underline"
            >
              {batch.batch_number}
            </Link>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Rezeptur</div>
            <div className="font-medium">
              {mixture?.name || "—"}
              {mixture?.mixture_number && (
                <span className="text-muted-foreground ml-1">
                  ({mixture.mixture_number})
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Hergestellt am</div>
            <div>{format(new Date(batch.produced_at), "dd.MM.yyyy HH:mm")}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Verantwortlicher</div>
            <div>{producer}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Menge</div>
            <div>
              {Number(batch.produced_quantity)} {batch.unit}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Konzentration</div>
            <div>{batch.concentration || "—"}</div>
          </div>
          {mixture?.category && (
            <div>
              <div className="text-xs text-muted-foreground">Kategorie</div>
              <Badge variant="secondary">{mixture.category}</Badge>
            </div>
          )}
        </div>

        {/* Recipe */}
        {recipe.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">Rezeptur (Soll)</div>
            <div className="border rounded-md divide-y">
              {recipe.map((r: any, i: number) => (
                <div key={i} className="flex justify-between px-3 py-1.5">
                  <span>
                    {r.material_name}
                    {r.material_number && (
                      <span className="text-muted-foreground ml-1">
                        ({r.material_number})
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {Number(r.quantity)} {r.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Consumed raw material batches */}
        <div>
          <div className="text-xs text-muted-foreground mb-1">
            Verwendete Rohstoffchargen (Ist)
          </div>
          {consumed.length === 0 ? (
            <div className="text-muted-foreground italic">—</div>
          ) : (
            <div className="border rounded-md divide-y">
              {consumed.map((c: any, i: number) => (
                <div
                  key={i}
                  className="flex flex-wrap justify-between gap-2 px-3 py-1.5"
                >
                  <span>
                    {c.material_name}
                    {c.material_number && (
                      <span className="text-muted-foreground ml-1">
                        ({c.material_number})
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {Number(c.quantity)} {c.unit}
                    {c.batch_number && (
                      <span className="ml-2 font-mono">· Charge {c.batch_number}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
