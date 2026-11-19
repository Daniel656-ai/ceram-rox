import { HorizontalScrollArea } from "@/components/ui/HorizontalScrollArea";
import { formatElementKey } from "@/lib/elementKeys";
import { toUnicode } from "@/lib/richText";
import {
  ACTIVITY_GAS_UNIT,
  type ActivityCatalyst,
  type ActivityField,
  type ActivityGas,
  type ActivityValue,
  type ActivityView,
} from "@/lib/results/activityMeasurement";

const nf = new Intl.NumberFormat("de-AT", { maximumFractionDigits: 6 });
const fmt = (v: ActivityValue | undefined): string => (v === null || v === undefined ? "–" : typeof v === "number" ? nf.format(v) : v);

const gasName = (g: ActivityGas) => formatElementKey(g);

function Head({ label, unit }: { label: string; unit?: string }) {
  return (
    <th className="whitespace-nowrap p-2 text-right font-medium">
      <div>{label}</div>
      {unit && <div className="text-[11px] font-normal text-muted-foreground">[{toUnicode(unit)}]</div>}
    </th>
  );
}

/** Ein Katalysator: Kopf mit Probendaten, Messbedingungen, Ergebnisse je Temperatur. Vorläufig grau, offiziell normal. */
function CatalystBlock({ cat, official, showTitle }: { cat: ActivityCatalyst; official: boolean; showTitle: boolean }) {
  const tone = official ? "" : "text-muted-foreground";
  const c = cat.conditions;
  const title = cat.title ?? (showTitle ? String(cat.index) : null);
  return (
    <div className="space-y-3">
      {title && (
        <p className="text-sm font-medium">
          Katalysator <span className="font-mono">{title}</span>
        </p>
      )}
      {cat.sampleData.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Probendaten</p>
          <dl className={`flex flex-wrap gap-x-5 gap-y-1 text-sm ${tone}`}>
            {cat.sampleData.map((f) => (
              <div key={f.label} className="flex gap-1.5">
                <dt className="text-muted-foreground">{f.label}</dt>
                <dd className="font-mono">
                  {fmt(f.value)}
                  {f.unit ? <span className="ml-1 font-sans text-xs text-muted-foreground">{f.unit}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Messbedingungen</p>
        <HorizontalScrollArea className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <Head label="AV" unit="m/h" />
                <Head label="FR" unit="Nm^{3}/h" />
                <Head label="NO in" unit="ppm" />
                <Head label={`${gasName("NH3")} in`} unit="ppm" />
                <Head label={`${formatElementKey("H2O")} in`} unit="%" />
                <Head label={`${formatElementKey("O2")} in`} unit="%" />
                <Head label={`${formatElementKey("N2")} in`} />
              </tr>
            </thead>
            <tbody>
              <tr className={`border-t font-mono ${tone}`}>
                {[c.av, c.fr, c.no, c.nh3, c.h2o, c.o2].map((v, i) => (
                  <td key={i} className="whitespace-nowrap p-2 text-right">{fmt(v)}</td>
                ))}
                <td className="whitespace-nowrap p-2 text-right font-sans">Rest</td>
              </tr>
            </tbody>
          </table>
        </HorizontalScrollArea>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Ergebnisse je Temperatur</p>
        <HorizontalScrollArea className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <Head label="Temperatur" unit="°C" />
                <Head label="η NOx" unit="%" />
                <Head label="K-Wert" unit="Nm/h" />
                {cat.gasColumns.map((g) => (
                  <th key={g} className="whitespace-nowrap p-2 text-right font-medium">
                    <div>{gasName(g)}</div>
                    <div className="text-[11px] font-normal text-muted-foreground">in / out [{ACTIVITY_GAS_UNIT[g]}]</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cat.rows.map((r, i) => (
                <tr key={i} className={`border-t font-mono ${tone}`}>
                  <td className="whitespace-nowrap p-2 text-right">{fmt(r.temperature)}</td>
                  <td className="whitespace-nowrap p-2 text-right">{fmt(r.eta)}</td>
                  <td className="whitespace-nowrap p-2 text-right">{fmt(r.k)}</td>
                  {cat.gasColumns.map((g) => {
                    const cell = r.gases[g];
                    return (
                      <td key={g} className="whitespace-nowrap p-2 text-right">
                        {cell && (cell.in !== null || cell.out !== null) ? `${fmt(cell.in)} / ${fmt(cell.out)}` : "–"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </HorizontalScrollArea>
      </div>
    </div>
  );
}

/** Weitere Angaben: alles, was keiner Tabelle zugeordnet werden konnte – klein am Ende. */
function OtherFields({ fields }: { fields: ActivityField[] }) {
  if (fields.length === 0) return null;
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
      <p className="mb-1 font-medium text-muted-foreground">Weitere Angaben</p>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5">
        {fields.map((f, i) => (
          <div key={`${f.label}-${i}`} className="contents">
            <dt className="text-muted-foreground">{f.label}</dt>
            <dd className="font-mono">
              {fmt(f.value)}
              {f.unit ? <span className="ml-1 font-sans text-muted-foreground">{f.unit}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Einheitliche Darstellung der Aktivitätsmessung (siehe tasks/014). Mehrere Katalysatoren stehen untereinander. */
export default function ActivityMeasurementView({ view }: { view: ActivityView }) {
  return (
    <div className="space-y-5" data-testid="activity-measurement">
      {view.catalysts.map((cat) => (
        <CatalystBlock key={`${cat.index}-${cat.title ?? ""}`} cat={cat} official={view.official} showTitle={view.catalysts.length > 1} />
      ))}
      <OtherFields fields={view.other} />
    </div>
  );
}
