import { Fragment } from "react";
import { HorizontalScrollArea } from "@/components/ui/HorizontalScrollArea";
import { formatElementKey } from "@/lib/elementKeys";
import { toUnicode } from "@/lib/richText";
import {
  ACTIVITY_GAS_UNIT,
  type ActivityCatalyst,
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

/** Ein Katalysator: Messbedingungen + Ergebnisse je Temperatur. Vorläufige Werte grau, offizielle normal. */
function CatalystBlock({ cat, official }: { cat: ActivityCatalyst; official: boolean }) {
  const tone = official ? "" : "text-muted-foreground";
  const c = cat.conditions;
  // Anzahl Kanäle / Zellenzahl nur, wenn für diesen Katalysator vorhanden.
  const showExtra = c.channels !== null || c.cells !== null;
  return (
    <div className="space-y-3">
      {cat.title && (
        <p className="text-sm font-medium">
          Katalysator <span className="font-mono">{cat.title}</span>
        </p>
      )}
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Messbedingungen</p>
        <HorizontalScrollArea className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <Head label="AV" unit="m/h" />
                <Head label="FR" unit="Nm^{3}/h" />
                {showExtra && <Head label="Anzahl Kanäle" />}
                {showExtra && <Head label="Zellenzahl" />}
                <Head label="NO in" unit="ppm" />
                <Head label={`${gasName("NH3")} in`} unit="ppm" />
                <Head label={`${formatElementKey("H2O")} in`} unit="%" />
                <Head label={`${formatElementKey("O2")} in`} unit="%" />
                <Head label={`${formatElementKey("N2")} in`} />
              </tr>
            </thead>
            <tbody>
              <tr className={`border-t font-mono ${tone}`}>
                {(showExtra ? [c.av, c.fr, c.channels, c.cells, c.no, c.nh3, c.h2o, c.o2] : [c.av, c.fr, c.no, c.nh3, c.h2o, c.o2]).map((v, i) => (
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

/** Darstellung der Aktivitätsmessung (siehe tasks/014). Mehrere Katalysatoren stehen untereinander. */
export default function ActivityMeasurementView({ view }: { view: ActivityView }) {
  return (
    <div className="space-y-5" data-testid="activity-measurement">
      {view.catalysts.map((cat, i) => (
        <Fragment key={`${cat.title ?? "kat"}-${i}`}>
          <CatalystBlock cat={cat} official={view.official} />
        </Fragment>
      ))}
    </div>
  );
}
