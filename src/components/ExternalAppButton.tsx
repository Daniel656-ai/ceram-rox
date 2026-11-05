import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { openExternalAppUrl, type ExternalAppConfig } from "@/lib/externalApps";

/**
 * Button zum Öffnen einer externen Fach-App (z. B. Extruder-/Staucher-App)
 * im Standardbrowser. Rein lesend – schreibt keine Daten.
 */
export function ExternalAppButton({
  app,
  url,
  size = "sm",
  variant = "outline",
  className,
  onClick,
}: {
  app: ExternalAppConfig;
  url: string;
  size?: "sm" | "default" | "icon";
  variant?: "outline" | "secondary" | "ghost";
  className?: string;
  /** Zusätzlicher Click-Handler (z. B. stopPropagation in Zeilen). */
  onClick?: (e: React.MouseEvent) => void;
}) {
  const [opening, setOpening] = useState(false);
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      disabled={opening}
      title={url}
      onClick={async (e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        setOpening(true);
        try {
          await openExternalAppUrl(url);
        } catch {
          toast.error(`${app.label} fehlgeschlagen`, {
            description: "Die externe App konnte nicht geöffnet werden.",
          });
        } finally {
          setOpening(false);
        }
      }}
    >
      <ExternalLink className="h-4 w-4 mr-2" />
      {app.label}
    </Button>
  );
}
