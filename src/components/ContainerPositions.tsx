import { useContainerPositions } from "@/hooks/useRawMaterials";
import { Badge } from "@/components/ui/badge";
import { formatQuantity } from "@/lib/formatQuantity";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function formatDate(value?: string | null) {
  if (!value) return "–";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "–" : d.toLocaleDateString("de-AT");
}

/**
 * Compact inline list of the LOT positions currently held in a container.
 * A container can hold several LOTs at the same time – they are never merged.
 * Falls back to the container's primary batch number (legacy) if no positions exist.
 */
export function ContainerPositions({
  containerId,
  unit,
  fallbackBatchNumber,
  variant = "inline",
}: {
  containerId: string;
  unit?: string;
  fallbackBatchNumber?: string | null;
  variant?: "inline" | "block";
}) {
  // Kompaktanzeige: nur aktive (nicht aufgebrauchte) LOTs
  const { data: positions, isLoading } = useContainerPositions(containerId, false);

  if (isLoading) return <span className="text-xs text-muted-foreground">…</span>;
  if (!positions || positions.length === 0) {
    return <span className="text-xs">{fallbackBatchNumber || "–"}</span>;
  }

  if (variant === "block") {
    return (
      <div className="space-y-1">
        {positions.map((p: any) => (
          <div key={p.position_id} className="flex items-center justify-between gap-2 text-xs">
            <span className="font-mono">{p.batch_number}</span>
            <span className="tabular-nums">{formatQuantity(p.quantity)} {unit || ""}</span>
          </div>
        ))}
      </div>
    );
  }

  // inline: comma-separated LOTs with qty
  return (
    <div className="flex flex-wrap gap-1">
      {positions.map((p: any) => (
        <Badge key={p.position_id} variant="outline" className="text-xs font-mono">
          {p.batch_number}
          <span className="ml-1 text-muted-foreground">{formatQuantity(p.quantity)}{unit ? ` ${unit}` : ""}</span>
        </Badge>
      ))}
    </div>
  );
}

/**
 * Detailed LOT list of a container in FIFO order (oldest entry first),
 * including depleted LOTs which stay visible for traceability.
 */
export function ContainerPositionDetails({
  containerId,
  unit,
  fallbackBatchNumber,
}: {
  containerId: string;
  unit?: string;
  fallbackBatchNumber?: string | null;
}) {
  const { data: positions, isLoading } = useContainerPositions(containerId, true);

  if (isLoading) return <div className="p-3 text-xs text-muted-foreground">LOTs werden geladen …</div>;
  if (!positions || positions.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        Keine LOT-Positionen erfasst{fallbackBatchNumber ? ` (LOT ${fallbackBatchNumber})` : ""}.
      </div>
    );
  }

  const active = positions.filter((p: any) => Number(p.quantity) > 0);
  const total = active.reduce((sum: number, p: any) => sum + Number(p.quantity || 0), 0);

  return (
    <div className="bg-muted/30 p-3 rounded-md">
      <div className="text-xs text-muted-foreground mb-2">
        {positions.length} LOT{positions.length === 1 ? "" : "s"} im Gebinde · Gesamtbestand{" "}
        <span className="font-mono tabular-nums">{formatQuantity(total)} {unit || ""}</span> · FIFO-Reihenfolge (ältester Zugang zuerst)
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-8">#</TableHead>
            <TableHead className="h-8">LOT</TableHead>
            <TableHead className="h-8">Zugang</TableHead>
            <TableHead className="h-8 text-right">Zugangsmenge</TableHead>
            <TableHead className="h-8 text-right">Restbestand</TableHead>
            <TableHead className="h-8">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((p: any, idx: number) => {
            const depleted = Number(p.quantity) <= 0;
            return (
              <TableRow key={p.position_id} className={depleted ? "text-muted-foreground" : undefined}>
                <TableCell className="text-xs py-1.5">{p.position_no ?? idx + 1}</TableCell>
                <TableCell className="font-mono text-xs py-1.5">{p.batch_number}</TableCell>
                <TableCell className="text-xs py-1.5">{formatDate(p.added_at)}</TableCell>
                <TableCell className="text-right font-mono text-xs py-1.5 tabular-nums">
                  {formatQuantity(p.initial_quantity)} {unit || ""}
                </TableCell>
                <TableCell className="text-right font-mono text-xs py-1.5 tabular-nums">
                  {formatQuantity(p.quantity)} {unit || ""}
                </TableCell>
                <TableCell className="py-1.5">
                  <Badge variant={depleted ? "secondary" : "default"} className="text-xs">
                    {depleted ? "Aufgebraucht" : idx === 0 || active[0]?.position_id === p.position_id ? "Aktiv (nächste Entnahme)" : "Aktiv"}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
