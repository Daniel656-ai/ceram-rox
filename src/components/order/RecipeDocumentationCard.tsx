import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListOrdered } from "lucide-react";
import { formatQuantity } from "@/lib/formatQuantity";
import {
  groupRecipeSections,
  parseRecipeValue,
  sectionTitle,
  type RecipeEntry,
} from "@/lib/recipeSections";

interface RecipeResult {
  key: string;
  title: string;
  context: string;
  entries: RecipeEntry[];
}

/**
 * Ergebnis „Rezeptur / Zugabefolge“ eines Auftrags (z. B. Knetung).
 * Zeigt die tatsächlich erfasste Rezeptur mit ihren Teilprozessschritten und
 * Zugabezeiten – bewusst getrennt von der Rohstoffvorgabe des Auftrags und von
 * der Fotodokumentation. Bestehende Rezepturen ohne Abschnittswechsel gelten
 * wie bisher als ein Abschnitt.
 */
export default function RecipeDocumentationCard({ orderId }: { orderId: string }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["order-photo-documentation", orderId],
    queryFn: () => api.measurementResults.listForOrder(orderId) as Promise<any[]>,
    enabled: !!orderId,
  });

  const { data: materials = [] } = useQuery({
    queryKey: ["raw-materials"],
    queryFn: () => api.rawMaterials.list(),
  });

  const materialById = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of materials as any[]) m.set(r.id, r);
    return m;
  }, [materials]);

  const recipes = useMemo<RecipeResult[]>(() => {
    const out: RecipeResult[] = [];
    for (const m of rows as any[]) {
      for (const r of m.measurement_results ?? []) {
        const entries = parseRecipeValue(r.remarks);
        if (!entries) continue;
        out.push({
          key: r.id,
          title: r.display_label || r.result_name,
          context: [m.samples?.sample_number, m.measurement_services?.service_name, m.measurement_number]
            .filter(Boolean)
            .join(" · "),
          entries,
        });
      }
    }
    return out;
  }, [rows]);

  if (isLoading || recipes.length === 0) return null;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-primary" />
          Rezeptur / Zugabefolge
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Tatsächlich erfasste Rezeptur mit Teilprozessschritten – nicht die Rohstoffvorgabe des
          Auftrags.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {recipes.map((rec) => {
          const sections = groupRecipeSections(rec.entries);
          return (
            <section key={rec.key} className="space-y-3">
              <header>
                <h4 className="text-sm font-medium">{rec.context || rec.title}</h4>
                <p className="text-xs text-muted-foreground">{rec.title}</p>
              </header>
              {sections.map((s, i) => {
                const offset = s.offset_minutes;
                const hasOffset = offset !== null && offset !== undefined && String(offset) !== "";
                return (
                  <div key={`${rec.key}-${s.markerIndex}-${i}`} className="rounded-md border p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{sectionTitle(s, i)}</span>
                      {hasOffset && (
                        <span className="text-xs text-muted-foreground">Zugabezeit: {offset} min</span>
                      )}
                    </div>
                    <ul className="mt-2 space-y-1">
                      {s.rows
                        .filter((r) => !!r.row.raw_material_id)
                        .map((r) => {
                          const mat = materialById.get(r.row.raw_material_id);
                          const qty = Number(r.row.quantity);
                          return (
                            <li key={r.index} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                              <span>
                                {mat?.material_name ?? "Unbekannter Rohstoff"}
                                {mat?.material_number ? ` (${mat.material_number})` : ""}
                              </span>
                              <span className="text-muted-foreground">
                                {isFinite(qty) && String(r.row.quantity ?? "") !== ""
                                  ? `${formatQuantity(qty)} ${r.row.unit || mat?.unit || ""}`.trim()
                                  : "—"}
                              </span>
                              {r.row.note && (
                                <span className="text-xs text-muted-foreground">· {r.row.note}</span>
                              )}
                            </li>
                          );
                        })}
                      {s.rows.filter((r) => !!r.row.raw_material_id).length === 0 && (
                        <li className="text-xs text-muted-foreground">Keine Rohstoffe erfasst.</li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
