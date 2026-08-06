import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Lock, Variable } from "lucide-react";
import { toast } from "sonner";
import {
  groupSystemVariables,
  listSystemVariables,
  formatSystemValue,
  type SystemContextData,
} from "@/lib/systemVariables";
import { useProcessContext } from "@/context/ProcessContextProvider";
import { listMasterDataTokens } from "@/lib/masterData";

/**
 * Designer-Bereich „Systemvariablen“.
 *
 * Zeigt alle vom Prozessmanager bereitgestellten Kontextvariablen. Die Tokens
 * können per Klick kopiert und in Labels, Textfeldern, Berechnungen,
 * Bedingungen, Berichten oder Skripten verwendet werden. Die Werte sind
 * grundsätzlich read-only – Änderungen erfolgen ausschließlich in den Modulen
 * Auftrag, Probe, Projekt, Benutzer und Prozess.
 */
export default function SystemVariablesPanel({
  context,
  compact = false,
  onInsert,
}: {
  /** Optionaler Beispielkontext; ohne Angabe wird der aktive Prozesskontext genutzt. */
  context?: SystemContextData;
  compact?: boolean;
  onInsert?: (token: string) => void;
}) {
  const live = useProcessContext();
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const vars = context ? listSystemVariables(context) : (live.list.length ? live.list : listSystemVariables());
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? vars.filter((v) => v.path.toLowerCase().includes(needle) || v.label.toLowerCase().includes(needle))
      : vars;
    const base = groupSystemVariables(filtered);

    // Stammdaten-Tokens (frei definierbare Attribute) ergänzen
    const md = listMasterDataTokens(live.masterData ?? []).filter(
      (t) => !needle || t.path.toLowerCase().includes(needle) || t.label.toLowerCase().includes(needle) || t.group.toLowerCase().includes(needle)
    );
    const byGroup = new Map<string, typeof md>();
    for (const t of md) byGroup.set(t.group, [...(byGroup.get(t.group) ?? []), t]);
    const mdGroups = Array.from(byGroup.entries()).map(([label, items]) => ({
      namespace: `stammdaten:${label}`,
      label: `Stammdaten · ${label}`,
      items: items.map((t) => ({ path: t.path, token: t.token, label: t.label, curated: true, value: undefined })),
    }));

    return [...base, ...mdGroups] as typeof base;
  }, [context, live.list, live.masterData, q]);

  const use = (token: string) => {
    if (onInsert) onInsert(token);
    else {
      navigator.clipboard?.writeText(token);
      toast.success(`${token} kopiert`);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Variable className="h-4 w-4" /> Systemvariablen
          <Badge variant="outline" className="gap-1 font-normal">
            <Lock className="h-3 w-3" /> read-only
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Werden vom Prozessmanager bereitgestellt (Auftrag, Probe, Projekt, Benutzer, Prozess) und
          müssen nicht als Formularfeld angelegt werden. Zusätzlich stehen alle Stammdaten-Eigenschaften zur Verfügung.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Variable suchen…"
          className="h-8"
        />
        <ScrollArea className={compact ? "h-64 pr-2" : "h-[420px] pr-2"}>
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.namespace}>
                <div className="text-xs font-semibold text-muted-foreground mb-1">{g.label}</div>
                <div className="space-y-1">
                  {g.items.map((v) => (
                    <button
                      key={v.path}
                      type="button"
                      onClick={() => use(v.token)}
                      className="w-full text-left border rounded px-2 py-1 hover:bg-muted/60 transition-colors"
                      title={onInsert ? "Einfügen" : "Token kopieren"}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono">{v.token}</span>
                        <Copy className="h-3 w-3 text-muted-foreground shrink-0" />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground">{v.label}</span>
                        {v.value !== undefined && v.value !== null && v.value !== "" && (
                          <span className="text-[11px] text-muted-foreground truncate max-w-[45%]">
                            {formatSystemValue(v.value)}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {groups.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">Keine Treffer.</p>
            )}
          </div>
        </ScrollArea>
        {!onInsert && (
          <p className="text-[11px] text-muted-foreground">
            Tipp: Token in Überschriften, Hinweistexten, Feld-Labels, Formeln und Berichten verwenden.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
