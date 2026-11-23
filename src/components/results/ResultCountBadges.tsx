import { Badge } from "@/components/ui/badge";

/**
 * Messwert-Zähler in EINER Zeile: „4 offiziell“ · „12 vorläufig“.
 * Keine offiziellen Werte → neutral grau statt hervorgehoben.
 */
export function ResultCountBadges({ official, interim }: { official: number; interim: number }) {
  return (
    <span className="inline-flex flex-nowrap items-center gap-1 whitespace-nowrap">
      {official > 0 ? (
        <Badge variant="default" className="text-[10px]">{official} offiziell</Badge>
      ) : (
        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">0 offiziell</Badge>
      )}
      {interim > 0 && <Badge variant="secondary" className="text-[10px]">{interim} vorläufig</Badge>}
    </span>
  );
}
