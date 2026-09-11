import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  computePlateGeometry,
  emptyPlateThicknessRow,
  emptyPlateWeightRow,
  plateRowCount,
  type PlateGeometryData,
  type PlateThicknessRow,
  type PlateWeightRow,
} from "@/lib/geometry/plate";
import type { ReactorGeometry } from "@/lib/geometry/calculations";

/**
 * Abschnitt „Geometrievermessung – Platte“.
 *
 * Reine Darstellung/Eingabe: sämtliche Berechnungen stammen aus den zentralen
 * Definitionen in `src/lib/geometry/plate.ts` (Formel-Engine), nicht aus dieser
 * Komponente.
 */
interface Props {
  data: PlateGeometryData;
  reactor: ReactorGeometry;
  readOnly?: boolean;
  onChange: (next: PlateGeometryData) => void;
}

const toNum = (v: string): number | null => {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const show = (v: number | null, decimals: number) =>
  v == null ? "—" : v.toLocaleString("de-DE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export default function PlateGeometrySection({ data, reactor, readOnly, onChange }: Props) {
  const result = useMemo(() => computePlateGeometry(data, reactor), [data, reactor]);
  const rows = plateRowCount(data);

  const thicknessRows: PlateThicknessRow[] = useMemo(
    () => Array.from({ length: rows }, (_, i) => data.thickness[i] ?? emptyPlateThicknessRow()),
    [rows, data.thickness],
  );
  const weightRows: PlateWeightRow[] = useMemo(
    () => Array.from({ length: rows }, (_, i) => data.weights[i] ?? emptyPlateWeightRow()),
    [rows, data.weights],
  );

  const setField = (key: keyof PlateGeometryData, value: number | null) =>
    onChange({ ...data, [key]: value } as PlateGeometryData);

  const setThickness = (index: number, key: keyof PlateThicknessRow, value: number | null) => {
    const next = thicknessRows.map((r, i) => (i === index ? { ...r, [key]: value } : r));
    onChange({ ...data, thickness: next });
  };

  const setWeight = (index: number, key: keyof PlateWeightRow, value: number | null) => {
    const next = weightRows.map((r, i) => (i === index ? { ...r, [key]: value } : r));
    onChange({ ...data, weights: next });
  };

  const numberField = (
    label: string,
    key: keyof PlateGeometryData,
    unit?: string,
  ) => (
    <div className="space-y-1">
      <Label className="text-xs">
        {label}
        {unit ? <span className="text-muted-foreground"> [{unit}]</span> : null}
      </Label>
      <Input
        type="text"
        inputMode="decimal"
        disabled={readOnly}
        value={(data[key] as number | null) ?? ""}
        onChange={(e) => setField(key, toNum(e.target.value))}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {numberField("Plattenlänge", "plattenlaenge", "mm")}
        {numberField("Breite: 1× Sicke", "breite_1x_sicke", "mm")}
        {numberField("Breite: 2× Sicke", "breite_2x_sicke", "mm")}
        {numberField("Plattenanzahl", "plattenanzahl")}
        {numberField("Stk. Doppelsicke", "stk_doppelsicke")}
        {numberField("Stk. Einzelsicke", "stk_einzelsicke")}
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Plattendicke – Einzelmessungen</h4>
        {rows === 0 ? (
          <p className="text-sm text-muted-foreground">
            Bitte zuerst die Plattenanzahl erfassen – die Zeilen richten sich danach.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">Platte</th>
                  <th className="py-1 pr-3 font-medium">Messwert 1 [mm]</th>
                  <th className="py-1 font-medium">Messwert 2 [mm]</th>
                </tr>
              </thead>
              <tbody>
                {thicknessRows.map((row, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-3">Platte {i + 1}</td>
                    <td className="py-1 pr-3">
                      <Input
                        type="text"
                        inputMode="decimal"
                        disabled={readOnly}
                        value={row.messwert_1 ?? ""}
                        onChange={(e) => setThickness(i, "messwert_1", toNum(e.target.value))}
                      />
                    </td>
                    <td className="py-1">
                      <Input
                        type="text"
                        inputMode="decimal"
                        disabled={readOnly}
                        value={row.messwert_2 ?? ""}
                        onChange={(e) => setThickness(i, "messwert_2", toNum(e.target.value))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Gewicht / Dimension</h4>
        {rows === 0 ? null : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">Platte</th>
                  <th className="py-1 pr-3 font-medium">Gewicht [g]</th>
                  <th className="py-1 pr-3 font-medium">Breite [mm]</th>
                  <th className="py-1 font-medium">Breite [mm]</th>
                </tr>
              </thead>
              <tbody>
                {weightRows.map((row, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-3">Platte {i + 1}</td>
                    <td className="py-1 pr-3">
                      <Input
                        type="text"
                        inputMode="decimal"
                        disabled={readOnly}
                        value={row.gewicht ?? ""}
                        onChange={(e) => setWeight(i, "gewicht", toNum(e.target.value))}
                      />
                    </td>
                    <td className="py-1 pr-3">
                      <Input
                        type="text"
                        inputMode="decimal"
                        disabled={readOnly}
                        value={row.breite_1 ?? ""}
                        onChange={(e) => setWeight(i, "breite_1", toNum(e.target.value))}
                      />
                    </td>
                    <td className="py-1">
                      <Input
                        type="text"
                        inputMode="decimal"
                        disabled={readOnly}
                        value={row.breite_2 ?? ""}
                        onChange={(e) => setWeight(i, "breite_2", toNum(e.target.value))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Berechnete Ergebnisse</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Mittelwert Plattendicke [mm]</div>
            <div>{show(result.mittelwerte.dicke, 3)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Mittelwert Gewicht [g]</div>
            <div>{show(result.mittelwerte.gewicht, 2)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Mittelwert Breite [mm]</div>
            <div>{show(result.mittelwerte.breite, 2)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Modulbreite [mm]</div>
            <div>{show(result.berechnet.modulbreite, 2)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Ap [m²/m³]</div>
            <div>{show(result.berechnet.ap, 1)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">ε [%]</div>
            <div>{show(result.berechnet.epsilon, 2)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Oberfläche [m²]</div>
            <div>{show(result.berechnet.oberflaeche, 4)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Reaktorgeometrie</div>
            <div>
              {reactor.label} ({reactor.widthMm} × {reactor.heightMm} mm)
            </div>
          </div>
        </div>
        {result.hints.length > 0 && (
          <ul className="text-xs text-muted-foreground list-disc pl-4">
            {result.hints.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
