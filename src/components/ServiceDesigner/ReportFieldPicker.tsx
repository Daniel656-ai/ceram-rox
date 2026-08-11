import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, ChevronDown, ChevronRight, Repeat, Sigma, Loader2 } from "lucide-react";
import type { ReportFieldGroup, ReportFieldItem } from "@/lib/reportFieldCatalog";

interface Props {
  groups: ReportFieldGroup[];
  isLoading?: boolean;
  /** Feld als eigener Baustein einfügen. */
  onInsertField: (item: ReportFieldItem) => void;
  /** Feld als Token in den aktuell gewählten Text-/Überschriftbaustein einfügen. */
  onInsertToken?: (item: ReportFieldItem) => void;
}

export default function ReportFieldPicker({ groups, isLoading, onInsertField, onInsertToken }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (i) =>
            i.label.toLowerCase().includes(needle) ||
            i.path.toLowerCase().includes(needle) ||
            i.sourceLabel.toLowerCase().includes(needle)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, q]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-3.5 w-3.5 mr-1" />Platzhalter
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="end">
        <div className="p-2 border-b">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Feld oder Datenquelle suchen…"
            className="h-8"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Auswahl stammt aus den vorhandenen Formularen, globalen Feldern und Berechnungen.
          </p>
        </div>
        <ScrollArea className="h-96">
          <div className="p-2 space-y-2">
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-3">
                <Loader2 className="h-4 w-4 animate-spin" />Felder werden geladen…
              </div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div className="text-sm text-muted-foreground p-3 text-center">
                Keine Felder gefunden.
              </div>
            )}
            {filtered.map((g) => {
              const isCollapsed = !!collapsed[g.key] && !q;
              return (
                <div key={g.key}>
                  <button
                    className="w-full flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground hover:text-foreground py-1"
                    onClick={() => setCollapsed((c) => ({ ...c, [g.key]: !c[g.key] }))}
                  >
                    {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {g.label}
                    <Badge variant="outline" className="ml-auto text-[10px]">{g.items.length}</Badge>
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-0.5 pl-3">
                      {g.items.map((item) => (
                        <div
                          key={`${g.key}:${item.path}`}
                          className="group flex items-center gap-2 rounded p-1.5 hover:bg-accent"
                        >
                          <button
                            className="flex-1 text-left"
                            onClick={() => { onInsertField(item); setOpen(false); }}
                          >
                            <div className="text-sm font-medium flex items-center gap-1">
                              {item.kind === "repeater" && <Repeat className="h-3 w-3 text-primary" />}
                              {item.kind === "computed" && <Sigma className="h-3 w-3 text-primary" />}
                              {item.label}
                              {item.unit && <span className="text-xs text-muted-foreground">[{item.unit}]</span>}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono truncate">{item.path}</div>
                          </button>
                          {onInsertToken && item.kind !== "repeater" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[10px] px-2 opacity-0 group-hover:opacity-100"
                              title="Als Token in den ausgewählten Text-Baustein einfügen"
                              onClick={() => { onInsertToken(item); setOpen(false); }}
                            >
                              in Text
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
