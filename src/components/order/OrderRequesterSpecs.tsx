import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  AmendableParam, SpecAmendDialog, SpecChangeHistory, groupSpecChanges,
} from "@/components/order/SpecAmendment";
import { rawMaterialValueLabel, type RawMaterialLookup } from "@/lib/rawMaterials/displayLabel";
import { parseSpecValue, isEmptySpecValue, primSpecValue, specLabelOf, specColLabel, specValueShape } from "@/lib/specValues";

/**
 * Read-only „Auftraggeber-Vorgaben“: zeigt die bei der Auftragserstellung
 * gespeicherten Werte (Snapshot) dieses Auftrags. Quelle sind ausschließlich
 * bereits geladene Daten: `order_measurements[].measurement_parameters`
 * (Bezeichnung, Wert, Einheit wurden beim Anlegen gespeichert) sowie
 * `shared_form_data.template.values` (Auftragsformular). Keine Defaults.
 */

const parse = parseSpecValue;
const isEmpty = isEmptySpecValue;
const prim = primSpecValue;
const labelOf = specLabelOf;

function RawCell({ col, value, materials }: { col: string | null; value: unknown; materials: Map<string, RawMaterialLookup> }) {
  // Reine Anzeige: Rohstoff-ID → „RK-Code – Rohstoffname“; gespeicherter Wert bleibt unverändert.
  const d = rawMaterialValueLabel(col, value, materials);
  if (d) return <span className={d.unresolved ? "italic text-muted-foreground" : undefined}>{d.label}</span>;
  return <>{prim(value)}</>;
}

const colLabel = specColLabel;

function ValueView({ raw, unit, materials }: { raw: unknown; unit?: string | null; materials: Map<string, RawMaterialLookup> }) {
  const shape = specValueShape(raw);
  if (shape.kind === "table") {
    const { rows, cols } = shape;
    return (
      <div className="overflow-x-auto">
        <table className="text-xs border rounded">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-2 py-1 text-left font-medium">#</th>
              {cols.map((c) => <th key={c} className="px-2 py-1 text-left font-medium">{colLabel(c)}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                {cols.map((c) => <td key={c} className="px-2 py-1">{isEmpty(r[c]) ? "–" : <RawCell col={c} value={r[c]} materials={materials} />}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (shape.kind === "list") {
    return (
      <div className="flex flex-wrap gap-1">
        {shape.items.map((x, i) => (
          <Badge key={i} variant="secondary" className="font-normal"><RawCell col={null} value={x} materials={materials} /></Badge>
        ))}
      </div>
    );
  }
  return <span><RawCell col={null} value={shape.value} materials={materials} />{unit ? ` ${unit}` : ""}</span>;
}

type Entry = {
  name: string; raw: unknown; unit: string | null; samples: string[];
  params: (AmendableParam & { status?: string })[];
};

export default function OrderRequesterSpecs({ order }: { order: any }) {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AmendableParam[] | null>(null);
  // Nur Master oder der konkrete Auftragsersteller; serverseitig erneut geprüft.
  const canAmend = role === "master" || (!!user && order?.created_by === user.id);

  const { data: events = [] } = useQuery({
    queryKey: ["order-activity", order?.id],
    queryFn: () => api.activityLog.listForOrder(order.id) as Promise<any[]>,
    enabled: !!order?.id,
  });
  const { data: rawMaterials = [] } = useQuery({
    queryKey: ["raw-materials"],
    queryFn: () => api.rawMaterials.list(),
    staleTime: 5 * 60 * 1000,
  });
  const materialById = useMemo(
    () => new Map((rawMaterials as any[]).map((m) => [m.id as string, m as RawMaterialLookup])),
    [rawMaterials],
  );
  const changesByParam = useMemo(() => groupSpecChanges(events as any[]), [events]);

  const groups = useMemo(() => {
    const m = new Map<string, { name: string; entries: Map<string, Entry> }>();
    for (const t of (order?.order_measurements || []) as any[]) {
      const params = (t.measurement_parameters || []) as any[];
      if (params.length === 0) continue;
      const key = t.service_id || "unbekannt";
      if (!m.has(key)) m.set(key, { name: t.measurement_services?.service_name || "Dienstleistung", entries: new Map() });
      const g = m.get(key)!;
      for (const p of params) {
        if (isEmpty(parse(p.parameter_value))) continue;
        const id = `${p.parameter_name}|${p.parameter_value}|${p.unit ?? ""}`;
        const e = g.entries.get(id) ?? { name: p.parameter_name, raw: p.parameter_value, unit: p.unit, samples: [], params: [] };
        const sn = t.samples?.sample_number;
        e.params.push({
          id: p.id, parameter_name: p.parameter_name, parameter_value: p.parameter_value,
          unit: p.unit, sampleNumber: sn ?? null, status: t.status,
        });
        if (sn && !e.samples.includes(sn)) e.samples.push(sn);
        g.entries.set(id, e);
      }
    }
    return Array.from(m.values())
      .map((g) => {
        const list = Array.from(g.entries.values());
        // Probennummer nur zeigen, wenn dieselbe Angabe je Probe abweicht.
        const counts = new Map<string, number>();
        list.forEach((e) => counts.set(e.name, (counts.get(e.name) ?? 0) + 1));
        return { name: g.name, entries: list.map((e) => ({ ...e, showSamples: (counts.get(e.name) ?? 0) > 1 })) };
      })
      .filter((g) => g.entries.length > 0);
  }, [order]);

  const templateValues = useMemo(() => {
    const vals = order?.shared_form_data?.template?.values;
    if (!vals || typeof vals !== "object") return [];
    return Object.entries(vals as Record<string, unknown>).filter(([, v]) => !isEmpty(v));
  }, [order]);

  const empty = groups.length === 0 && templateValues.length === 0;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4" /> Auftraggeber-Vorgaben
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {empty && (
          <p className="text-sm text-muted-foreground">Keine Auftraggeber-Vorgaben gespeichert.</p>
        )}
        {templateValues.length > 0 && (
          <div className="space-y-1">
            <div className="text-sm font-medium">Auftragsformular</div>
            <dl className="grid grid-cols-[minmax(10rem,max-content)_1fr] gap-x-4 gap-y-1 text-sm">
              {templateValues.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd><ValueView raw={v} materials={materialById} /></dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {groups.map((g) => (
          <div key={g.name} className="space-y-1">
            <div className="text-sm font-medium">{g.name}</div>
            <dl className="grid grid-cols-[minmax(10rem,max-content)_1fr] gap-x-4 gap-y-1 text-sm">
              {g.entries.map((e, i) => (
                <div key={i} className="contents">
                  <dt className="text-muted-foreground">
                    {labelOf(e.name)}
                    {e.showSamples && e.samples.length > 0 && (
                      <span className="ml-1 font-mono text-xs">({e.samples.join(", ")})</span>
                    )}
                  </dt>
                  <dd className="space-y-1">
                    <div className="flex items-start gap-2">
                      <div className="flex-1"><ValueView raw={e.raw} unit={e.unit} materials={materialById} /></div>
                      {canAmend && e.params.some((p) => p.status !== "completed") && (
                        <Button
                          type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs"
                          onClick={() => setEditing(e.params.filter((p) => p.status !== "completed"))}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          {e.name.startsWith("repeat:") ? "Eintrag ergänzen / bearbeiten" : "Vorgabe ändern"}
                        </Button>
                      )}
                    </div>
                    {(() => {
                      const ch = e.params.flatMap((p) => changesByParam.get(p.id) ?? [])
                        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                      return ch.length > 0 ? <SpecChangeHistory changes={ch} /> : null;
                    })()}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </CardContent>
      {editing && (
        <SpecAmendDialog
          open={!!editing}
          onOpenChange={(v) => { if (!v) setEditing(null); }}
          params={editing}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["order"] });
            qc.invalidateQueries({ queryKey: ["order-activity", order?.id] });
          }}
        />
      )}
    </Card>
  );
}
