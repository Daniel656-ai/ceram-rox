import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrderExcelExport } from "@/hooks/useOrderExcelExport";

/**
 * Knopf „Auftrag als Excel exportieren“: Blatt „Übersicht“ + je Probe ein Blatt, nur offizielle Werte.
 * Rechte wie beim Ansehen (der Knopf steht nur dort, wo die Ergebnisse ohnehin sichtbar sind).
 */
export default function OrderExcelExportButton({
  orderId,
  label = "Als Excel exportieren",
  iconOnly = false,
}: {
  orderId: string;
  label?: string;
  iconOnly?: boolean;
}) {
  const { exportOrder, exporting } = useOrderExcelExport();
  const Icon = exporting ? Loader2 : FileSpreadsheet;
  return (
    <Button
      type="button"
      variant="outline"
      size={iconOnly ? "icon" : "sm"}
      className={iconOnly ? "h-8 w-8" : "h-8 text-xs"}
      disabled={!orderId || exporting}
      aria-label={label}
      title="Ganzen Auftrag als Excel-Datei exportieren (Übersicht + je Probe ein Blatt, nur offizielle Werte)"
      onClick={() => void exportOrder(orderId)}
    >
      <Icon className={`h-4 w-4 ${iconOnly ? "" : "mr-1"} ${exporting ? "animate-spin" : ""}`} />
      {!iconOnly && label}
    </Button>
  );
}
