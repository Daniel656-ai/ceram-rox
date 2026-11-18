import { useMemo, useState } from "react";
import { Lock, CheckCircle2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpecAmendDialog, specLabel, type AmendableParam } from "@/components/order/SpecAmendment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BLOCKER_TEXT, type OrderEditFacts } from "@/lib/orders/orderEdit";

/**
 * Bearbeiten-Modus (Stufe 1): die Dienstleistungen des Auftrags an derselben Stelle wie beim Erstellen,
 * aber SCHREIBGESCHÜTZT. Zeigt je Dienstleistung ihre Aufgaben (je Probe) mit Sperrstatus:
 *   - „unberührt“: in einer späteren Stufe änderbar/entfernbar
 *   - „bereits in Bearbeitung“: gesperrt (mit Gründen)
 * Auftraggeber-Vorgaben werden nur angezeigt; nachträgliche Änderungen laufen weiter über
 * „Auftraggeber-Vorgaben → nachträglich ändern“ im Auftrag (mit Begründung).
 */

const isStructured = (v: string) => /^\s*[\[{]/.test(v);

/** Wert einer Vorgabe lesbar – strukturierte Werte nie als Rohtext. */
function paramText(p: { parameter_value?: string | null; unit?: string | null }): string {
  const v = String(p.parameter_value ?? "").trim();
  if (!v) return "–";
  if (isStructured(v)) {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return `Liste mit ${parsed.length} ${parsed.length === 1 ? "Eintrag" : "Einträgen"}`;
      return "Mehrere Angaben";
    } catch {
      return "Strukturierter Wert";
    }
  }
  return p.unit ? `${v} ${p.unit}` : v;
}

export default function ExistingServicesReadOnly({
  measurements,
  facts,
  canAmend = false,
  onAmended,
}: {
  measurements: any[];
  facts: OrderEditFacts | null | undefined;
  /** Stufe 2: Vorgaben je Aufgabe nachträglich ändern (mit Begründung, über die geprüfte Funktion amend_order_spec). */
  canAmend?: boolean;
  onAmended?: () => void;
}) {
  const [editing, setEditing] = useState<AmendableParam[] | null>(null);
  const factById = useMemo(
    () => new Map((facts?.measurements ?? []).map((m) => [m.measurement_id, m])),
    [facts],
  );
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; tasks: any[] }>();
    for (const m of measurements ?? []) {
      const key = m.service_id ?? m.id;
      if (!map.has(key)) map.set(key, { name: m.measurement_services?.service_name || "Dienstleistung", tasks: [] });
      map.get(key)!.tasks.push(m);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [measurements]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          Dienstleistungen
          <Badge variant="outline" className="gap-1 text-[10px] font-normal">
            <Lock className="h-3 w-3" /> nur lesbar
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Dienstleistungen selbst sind in dieser Version noch nicht änderbar.{canAmend ? " Vorgaben können je Aufgabe über „Vorgabe ändern“ angepasst werden – mit Begründung, die Änderung steht im Verlauf." : ""}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {groups.length === 0 && <p className="text-sm text-muted-foreground">Keine Dienstleistungen im Auftrag.</p>}
        {groups.map((g) => (
          <div key={g.name} className="rounded-md border">
            <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
              <span className="text-sm font-medium">{g.name}</span>
              <span className="text-xs text-muted-foreground">
                {g.tasks.length} {g.tasks.length === 1 ? "Aufgabe" : "Aufgaben"}
              </span>
            </div>
            <ul className="divide-y">
              {g.tasks.map((m) => {
                const f = factById.get(m.id);
                const untouched = f ? f.untouched : m.status === "open";
                const params: any[] = (m.measurement_parameters ?? []).filter((p: any) => p.parameter_name);
                return (
                  <li key={m.id} className="space-y-1 px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono">{m.measurement_number || "–"}</span>
                      {m.samples?.sample_number && (
                        <span className="text-muted-foreground">Probe {m.samples.sample_number}</span>
                      )}
                      {untouched ? (
                        <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" /> unberührt
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 text-[10px] font-normal" title="Gesperrt: bereits in Bearbeitung">
                          <Lock className="h-3 w-3" /> bereits in Bearbeitung
                          {f && f.blockers.length > 0 && (
                            <span className="text-muted-foreground">
                              · {f.blockers.map((b) => BLOCKER_TEXT[b] ?? b).join(", ")}
                            </span>
                          )}
                        </Badge>
                      )}
                    </div>
                    {params.length > 0 && (
                      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-muted-foreground">
                        {params.map((p) => (
                          <div key={p.id ?? p.parameter_name} className="contents">
                            <dt>{String(p.parameter_name).replace(/^repeat:/, "")}</dt>
                            <dd className="flex items-start gap-2 break-words text-foreground">
                              <span className="flex-1">{paramText(p)}</span>
                              {canAmend && m.status !== "completed" && p.id && (
                                <Button
                                  type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs"
                                  aria-label={`Vorgabe ${specLabel(p.parameter_name)} ändern`}
                                  onClick={() => setEditing([{
                                    id: p.id, parameter_name: p.parameter_name, parameter_value: p.parameter_value ?? null,
                                    unit: p.unit ?? null, sampleNumber: m.samples?.sample_number ?? null,
                                  }])}
                                >
                                  <Pencil className="mr-1 h-3 w-3" />
                                  {String(p.parameter_name).startsWith("repeat:") ? "Einträge bearbeiten" : "Vorgabe ändern"}
                                </Button>
                              )}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </CardContent>
      {editing && (
        <SpecAmendDialog
          open={!!editing}
          onOpenChange={(v) => { if (!v) setEditing(null); }}
          params={editing}
          onSaved={() => onAmended?.()}
        />
      )}
    </Card>
  );
}
