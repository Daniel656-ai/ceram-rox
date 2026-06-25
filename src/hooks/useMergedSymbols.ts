import { useMemo } from "react";
import { useCustomSymbols } from "@/hooks/useCustomSymbols";
import { GHS_SYMBOLS, PSA_SYMBOLS } from "@/lib/labels/symbols";
import type { SymbolCategory } from "@/lib/api/customSymbols";

export interface MergedSymbol {
  key: string;
  label: string;
  src: string;
  custom: boolean;
}

/**
 * Liefert die Liste aller verfügbaren Symbole (System + benutzerdefiniert),
 * gemerged nach Code. Benutzerdefinierte Symbole überschreiben Systemvarianten
 * mit dem selben Code.
 */
export function useMergedSymbols(category: SymbolCategory): MergedSymbol[] {
  const { data: custom = [] } = useCustomSymbols(category);
  return useMemo(() => {
    const base: MergedSymbol[] = (category === "ghs" ? GHS_SYMBOLS : PSA_SYMBOLS).map((s) => ({
      key: s.key,
      label: s.label,
      src: s.src,
      custom: false,
    }));
    const map = new Map<string, MergedSymbol>(base.map((s) => [s.key, s]));
    for (const c of custom) {
      if (!c.is_active) continue;
      map.set(c.code, {
        key: c.code,
        label: c.name,
        src: c.image_data_url,
        custom: true,
      });
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [category, custom]);
}
