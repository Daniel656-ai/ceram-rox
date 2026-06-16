import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useRecipeAvailability } from "@/hooks/useMixtureProcess";

interface Props {
  versionId: string | undefined;
  scale?: number;
}

export function RecipeAvailability({ versionId, scale = 1 }: Props) {
  const { data = [] } = useRecipeAvailability(versionId, scale);

  const missing = useMemo(() => (data as any[]).filter((r) => Number(r.missing) > 0), [data]);
  const hasData = (data as any[]).length > 0;

  if (!versionId || !hasData) return null;

  if (missing.length === 0) {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Alle Rohstoffe verfügbar</AlertTitle>
        <AlertDescription>
          Die geplante Rezeptur kann mit dem aktuellen Lagerbestand vollständig produziert werden.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        Nicht vollständig produzierbar
        <Badge variant="destructive">{missing.length} fehlend</Badge>
      </AlertTitle>
      <AlertDescription>
        <ul className="mt-2 space-y-1 text-sm">
          {missing.map((r: any) => (
            <li key={r.raw_material_id}>
              <strong>{r.material_name}</strong>
              {r.material_number && (
                <span className="text-xs opacity-80"> ({r.material_number})</span>
              )}
              : benötigt {Number(r.required).toFixed(3)} {r.unit}, verfügbar{" "}
              {Number(r.available).toFixed(3)} {r.unit}, <strong>fehlt {Number(r.missing).toFixed(3)} {r.unit}</strong>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
