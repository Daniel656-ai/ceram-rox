import { HorizontalScrollArea } from "@/components/ui/HorizontalScrollArea";
import SampleLabel from "@/components/results/SampleLabel";
import { formatElementKey } from "@/lib/elementKeys";
import { toUnicode } from "@/lib/richText";
import {
  catalystHeading,
  gasUnitOf,
  hasConditions,
  type ActivityCatalyst,
  type ActivityField,
  type ActivityGas,
  type ActivityValue,
  type ActivityView,
} from "@/lib/results/activityMeasurement";

const nf = new Intl.NumberFormat("de-AT", { maximumFractionDigits: 6 });
const fmt = (v: ActivityValue | undefined): string => (v === null || v === undefined ? "–" : typeof v === "number" ? nf.format(v) : v);

const gasName = (g: ActivityGas) => formatElementKey(g);

export interface ActivitySampleRef {
  number: string | null | undefined;
  name: string | null | undefined;
}

function Head({ label, unit }: { label: string; unit?: string }) {
  return (
    <th className="whitespace-nowrap p-2 text-right font-medium">
      <div>{label}</div>
      {unit && <div className="text-[11px] font-normal text-muted-foreground">[{toUnicode(unit)}]</div>}
    </th>
  );
}

const Hint = ({ title, text }: { title: string; text: string }) => (
  <div>
    <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
    <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">{text}</p>
  </div>
);

/** Ein Katalysator: [Katalysator …], Probendaten, Messbedingungen, Ergebnisse je Temperatur. Vorläufig grau, offiziell normal. */
function CatalystBlock({ cat, official, heading }: { cat: ActivityCatalyst; official: boolean; heading: string | null }) {
  const tone = official ? "" : "text-muted-foreground";
  const c = cat.conditions;
  return (
    <div className="space-y-3">
      {heading && (
        <p className="text-sm font-medium">
          Katalysator <span className="font-mono">{heading}</span>
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
      {hasConditions(c) ? (
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
                  {c.extra.map((e) => (
                    <Head key={e.compound} label={`${formatElementKey(e.compound)} in`} unit={e.unit} />
                  ))}
                  <Head label={`${formatElementKey("N2")} in`} />
                </tr>
              </thead>
              <tbody>
                <tr className={`border-t font-mono ${tone}`}>
                  {[c.av, c.fr, c.no, c.nh3, c.h2o, c.o2].map((v, i) => (
                    <td key={i} className="whitespace-nowrap p-2 text-right">{fmt(v)}</td>
                  ))}
                  {c.extra.map((e) => (
                    <td key={e.compound} className="whitespace-nowrap p-2 text-right">{fmt(e.value)}</td>
                  ))}
                  <td className="whitespace-nowrap p-2 text-right font-sans">Rest</td>
                </tr>
              </tbody>
            </table>
          </HorizontalScrollArea>
        </div>
      ) : (
        <Hint title="Messbedingungen" text="keine Messbedingungen erfasst" />
      )}
      {cat.rows.length > 0 ? (
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
                      <div className="text-[11px] font-normal text-muted-foreground">in / out [{gasUnitOf(cat, g)}]</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cat.rows.map((r, i) => (
                  <tr key={i} className={`border-t font-mono ${tone}`}>
                    <td className="whitespace-nowrap p-2 text-right">
                      {fmt(r.temperature)}
                      {r.temperatureTarget != null && (
                        <div
                          className="font-sans text-[11px] font-normal text-amber-700"
                          title="Die gemessene Temperatur weicht von der Vorgabe im Auftrag ab."
                        >
                          Vorgabe {fmt(r.temperatureTarget)} (weicht ab)
                        </div>
                      )}
                    </td>
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
      ) : (
        <Hint title="Ergebnisse je Temperatur" text="keine Ergebnisse je Temperatur erfasst" />
      )}
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

/**
 * Einheitliche Darstellung der Aktivitätsmessung (Regel: tasks/gestaltungsregeln.md, Abschnitt „Aktivitätsmessung“).
 * Kopf: Probe (Bezeichnung groß, Nummer klein); „Katalysator …“ nur bei echter Katalysatornummer, die nicht der
 * Probenbezeichnung entspricht.
 */
export default function ActivityMeasurementView({
  view,
  sample,
  onSampleClick,
}: {
  view: ActivityView;
  sample?: ActivitySampleRef;
  onSampleClick?: () => void;
}) {
  return (
    <div className="space-y-5" data-testid="activity-measurement">
      {sample && (
        <div className="text-sm">
          {onSampleClick ? (
            <button type="button" className="text-left hover:underline" onClick={onSampleClick}>
              <SampleLabel number={sample.number} name={sample.name} />
            </button>
          ) : (
            <SampleLabel number={sample.number} name={sample.name} />
          )}
        </div>
      )}
      {view.catalysts.map((cat) => (
        <CatalystBlock
          key={`${cat.index}-${cat.title ?? ""}`}
          cat={cat}
          official={view.official}
          heading={catalystHeading(cat, view.catalysts.length, sample)}
        />
      ))}
      <OtherFields fields={view.other} />
    </div>
  );
}
