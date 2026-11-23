import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Kleines ⓘ mit Erklärtext im Tooltip (statt dauerhaft sichtbarem Hilfetext). */
export function InfoHint({ children, label = "Hinweis" }: { children: ReactNode; label?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="rounded-full text-muted-foreground hover:text-foreground" aria-label={label}>
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs font-normal leading-relaxed">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
