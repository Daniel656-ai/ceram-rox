import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera } from "lucide-react";
import { normalizeImageValue, type ImageEntry } from "@/lib/imageGallery";
import ImageGalleryField from "@/components/forms/ImageGalleryField";

interface PhotoGroup {
  key: string;
  title: string;
  context: string;
  entries: ImageEntry[];
}

/**
 * Fotodokumentation eines Auftrags: alle Bildfelder der Messungen –
 * großes Bild mit zugehörigem Kommentar, in gespeicherter Reihenfolge.
 */
export default function PhotoDocumentationCard({ orderId }: { orderId: string }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["order-photo-documentation", orderId],
    queryFn: () => api.measurementResults.listForOrder(orderId) as Promise<any[]>,
    enabled: !!orderId,
  });

  const groups = useMemo<PhotoGroup[]>(() => {
    const out: PhotoGroup[] = [];
    for (const m of rows as any[]) {
      for (const r of m.measurement_results ?? []) {
        const entries = normalizeImageValue(r.remarks);
        if (entries.length === 0) continue;
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

  if (isLoading || groups.length === 0) return null;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" />
          Fotodokumentation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {groups.map((g) => (
          <section key={g.key} className="space-y-2">
            <header>
              <h4 className="text-sm font-medium">{g.title}</h4>
              {g.context && <p className="text-xs text-muted-foreground">{g.context}</p>}
            </header>
            <ImageGalleryField
              fieldKey={g.key}
              mode={g.entries.length > 1 ? "multi" : "single"}
              value={g.entries}
              onChange={() => { /* Ausgabe ist unveränderlich */ }}
              readOnly
            />
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
