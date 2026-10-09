import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { PrintHeader } from "@/components/PrintHeader";
import { Outlet } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { refreshCurrentView, UnsavedInputError } from "@/lib/refreshGuard";

function RefreshViewButton() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await refreshCurrentView(qc);
    } catch (e) {
      if (e instanceof UnsavedInputError) {
        toast.error("Ansicht nicht aktualisiert", {
          description: "Ungespeicherte Eingaben konnten nicht gesichert werden. Ihre Eingaben bleiben erhalten.",
        });
      } else {
        toast.error("Aktualisierung fehlgeschlagen", {
          description: "Die Daten konnten nicht neu geladen werden. Bitte später erneut versuchen.",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={onClick} disabled={busy} aria-label="Ansicht aktualisieren">
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Ansicht aktualisieren</TooltipContent>
    </Tooltip>
  );
}

export function AppLayout() {
  // Rein technisches Nutzungs-Tracking (module_opened), ohne fachliche Logik.
  useUsageTracking();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full max-w-full overflow-x-hidden">
        <AppSidebar />
        <div className="flex-1 min-w-0 flex flex-col">

          <header className="h-14 border-b flex items-center justify-between px-4 bg-card print:hidden">
            <SidebarTrigger />
            <RefreshViewButton />
          </header>
          <PrintHeader />
          <main className="flex-1 p-6 overflow-auto print:p-0">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
