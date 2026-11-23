import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * Liste links, Seitenleiste rechts (breite Ansicht, geteilt) bzw. überlagernd als
 * Sheet (schmale Ansicht). Ohne `open` wird nur die Liste gezeigt.
 */
export default function SidePanelLayout({
  open,
  isWide,
  panel,
  onClose,
  children,
}: {
  open: boolean;
  isWide: boolean;
  panel: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <div className={open && isWide ? "grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-4" : ""}>
        <div className="min-w-0">{children}</div>
        {open && isWide && (
          <aside
            className="sticky top-2 max-h-[calc(100vh-1rem)] overflow-y-auto rounded-md border bg-background p-3"
            aria-label="Details"
          >
            {panel}
          </aside>
        )}
      </div>
      {open && !isWide && (
        <Sheet open onOpenChange={(o) => !o && onClose()}>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
            <SheetHeader className="sr-only">
              <SheetTitle>Details</SheetTitle>
              <SheetDescription>Probe bzw. Ergebnisübersicht des Auftrags</SheetDescription>
            </SheetHeader>
            {panel}
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
