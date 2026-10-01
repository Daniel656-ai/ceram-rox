import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";

/**
 * Read-only „Auftraggeber-Vorgaben“: zeigt die bei der Auftragserstellung
 * gespeicherten Werte (Snapshot) dieses Auftrags. Quelle sind ausschließlich
 * bereits geladene Daten: `order_measurements[].measurement_parameters`
 * (Bezeichnung, Wert, Einheit wurden beim Anlegen gespeichert) sowie
 * `shared_form_data.template.values` (Auftragsformular). Keine Defaults.
 */

const parse = (raw: unknown): unknown => {
  if (typeof raw !== "string") return raw;
  const s = raw.trim();
  if ((s.startsWith("[") && s.endsWith("]")) || (s.startsWith("{") && s.endsWith("}"))) {
    try { return JSON.parse(s); } catch { return raw; }
  }
  return raw;
};

const isEmpty = (v: unknown) =>
  v == null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

const prim = (v: unknown): string => {
  if (v === true || v === "true") return "Ja";
  if (v === false || v === "false") return "Nein";
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const label = o.label ?? o.name ?? o.display_name ?? o.value;
    if (label != null && typeof label !== "object") return String(label);
    return Object.entries(o).filter(([, x]) => !isEmpty(x)).map(([k, x]) => `${k}: ${prim(x)}`).join(", ");
  }
  return String(v);
};

const labelOf = (name: string) => name.replace(/^repeat:/, "");

function ValueView({ raw, unit }: { raw: unknown; unit?: string | null }) {
  const v = parse(raw);
  if (Array.isArray(v) && v.some((x) => x && typeof x === "object" && !Array.isArray(x))) {
    const rows = v.filter((x) => x && typeof x === "object") as Record<string, unknown>[];
    const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r).filter((k) => !k.startsWith("__")))));
    return (
      <div className="overflow-x-auto">
        <table className="text-xs border rounded">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-2 py-1 text-left font-medium">#</th>
              {cols.map((c) => <th key={c} className="px-2 py-1 text-left font-medium">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                {cols.map((c) => <td key={c} className="px-2 py-1">{isEmpty(r[c]) ? "–" : prim(r[c])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (Array.isArray(v)) {
    return (
      <div className="flex flex-wrap gap-1">
        {v.filter((x) => !isEmpty(x)).map((x, i) => (
          <Badge key={i} variant="secondary" className="font-normal">{prim(x)}</Badge>
        ))}
      </div>
    );
  }
  return <span>{prim(v)}{unit ? ` ${unit}` : ""}</span>;
}

type Entry = { name: string; raw: unknown; unit: string | null; samples: string[] };

export default function OrderRequesterSpecs({ order }: { order: any }) {
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
        const e = g.entries.get(id) ?? { name: p.parameter_name, raw: p.parameter_value, unit: p.unit, samples: [] };
        const sn = t.samples?.sample_number;
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
                  <dd><ValueView raw={v} /></dd>
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
                  <dd><ValueView raw={e.raw} unit={e.unit} /></dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
