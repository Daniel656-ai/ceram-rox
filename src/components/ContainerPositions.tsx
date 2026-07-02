import { useContainerPositions } from "@/hooks/useRawMaterials";
import { Badge } from "@/components/ui/badge";
import { formatQuantity } from "@/lib/formatQuantity";

/**
 * Compact inline list of the LOT positions currently held in a container.
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
  const { data: positions, isLoading } = useContainerPositions(containerId);

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
