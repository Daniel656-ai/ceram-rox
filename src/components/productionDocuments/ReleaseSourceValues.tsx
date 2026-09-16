/**
 * Zeigt die Quellwerte einer m³-Liste – aufgelöst gegen GENAU die gespeicherte
 * Fertigungsfreigabe-Revision. Reine Leseansicht; es wird nichts in die
 * Fertigungsfreigabe zurückgeschrieben.
 */
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";
import { useProductionReleaseRevision } from "@/hooks/useProductionDocuments";
import {
  RELEASE_FIELD_CATALOG, resolveProductionReleaseField,
} from "@/lib/productionReleaseRef";

export default function ReleaseSourceValues({ releaseId }: { releaseId: string | null }) {
  const { data: release, isLoading, isError } = useProductionReleaseRevision(releaseId);

  if (!releaseId) {
    return <p className="text-sm text-muted-foreground">Dieser m³-Liste ist noch keine Fertigungsfreigabe-Revision zugeordnet.</p>;
  }
  if (isLoading) return <p className="text-sm text-muted-foreground">Quellwerte werden geladen …</p>;
  if (isError || !release) {
    return (
      <p className="text-sm text-destructive flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" /> Die hinterlegte Fertigungsfreigabe-Revision konnte nicht geladen werden.
      </p>
    );
  }

  const rev = Number((release as Record<string, unknown>).revision_number) || 0;

  return (
    <div className="space-y-3">
      <div className="text-sm">
        Quelle:{" "}
        <span className="font-mono">{String((release as Record<string, unknown>).release_number ?? "–")}</span>{" "}
        <Badge variant="outline">Rev{rev}</Badge>{" "}
        <span className="text-muted-foreground">
          (fest hinterlegt – eine neue Revision ändert diese m³-Liste nicht)
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Feld</TableHead>
            <TableHead>Art</TableHead>
            <TableHead>Wert aus dieser Revision</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {RELEASE_FIELD_CATALOG.map((def) => {
            const res = resolveProductionReleaseField(
              { release_id: releaseId, field_key: def.key },
              release as Record<string, unknown>
            );
            return (
              <TableRow key={def.key}>
                <TableCell className="text-sm">{def.label}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      def.role === "yellow"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {def.role === "yellow" ? "zu bestätigen" : "übernommen"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {res.status === "ok" ? (
                    <>
                      {String(res.value)}
                      {res.unit ? <span className="text-muted-foreground"> {res.unit}</span> : null}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">{res.reason}</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
