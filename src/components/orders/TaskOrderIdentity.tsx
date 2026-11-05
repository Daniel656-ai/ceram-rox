import { orderIdentity, type OrderIdentitySource } from "@/lib/orders/orderIdentity";
import { cn } from "@/lib/utils";

/**
 * Anzeige der Auftragsidentität in Aufgabenlisten (nur Darstellung).
 * Pilot Plant: Versuchsnummer fett, darunter „Auftrag: <Nr.>“; ohne Versuchsnummer dezenter Hinweis.
 * Labor/Klassisch: unveränderte Auftragsnummer.
 */
export function TaskOrderIdentity({
  order,
  className,
  compact = false,
}: {
  order: OrderIdentitySource | null | undefined;
  className?: string;
  compact?: boolean;
}) {
  if (!order) return <span className={className}>–</span>;
  const id = orderIdentity(order);
  if (!id.hasExperimentNumber && !id.missingExperimentNumber) {
    return <span className={cn("font-mono", className)}>{id.technicalNumber || "–"}</span>;
  }
  return (
    <span className={cn("inline-flex flex-col leading-tight", className)}>
      {id.hasExperimentNumber ? (
        <span className="font-bold font-mono" data-testid="experiment-number">{id.number}</span>
      ) : (
        <span className="text-xs italic text-muted-foreground">Keine Versuchsnummer</span>
      )}
      <span className={cn("text-muted-foreground font-mono", compact ? "text-[11px]" : "text-xs")}>
        Auftrag: {id.technicalNumber || "–"}
      </span>
    </span>
  );
}
