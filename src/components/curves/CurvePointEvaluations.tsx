import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { curveOf, findChannel, interpolateAt, type MeasurementDataset } from "@/lib/curves/dataset";
import type { CurveEvaluationRecord } from "@/lib/api/measurementRawData";

interface Props {
  datasetId: string;
  dataset: MeasurementDataset;
  /** Aktuelle X-Achse aus der Kurvenansicht. */
  xKey: string;
  /** Aktuell dargestellte Kurven – Vorauswahl für die Auswertung. */
  yKeys: string[];
  records: CurveEvaluationRecord[];
  onChanged: () => void;
  readOnly?: boolean;
}

const fmt = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v)
    ? "—"
    : Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v !== 0)
      ? v.toExponential(4)
      : v.toLocaleString("de-AT", { maximumFractionDigits: 6 });

/** Gespeicherte Auswertungspunkte nach Stelle gruppiert. */
export function groupPointEvaluations(records: CurveEvaluationRecord[]) {
  const groups = new Map<string, { key: string; x: number; comment: string | null; includeInReport: boolean; rows: CurveEvaluationRecord[] }>();
  for (const r of records) {
    if (r.kind !== "point") continue;
    const key = r.group_id ?? r.id;
    const x = Number(r.x_at ?? r.x_from);
    const g = groups.get(key) ?? { key, x, comment: r.comment, includeInReport: r.include_in_report, rows: [] };
    g.rows.push(r);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => a.x - b.x);
}

/**
 * „Wert an definierter Stelle" für beliebig viele X-Positionen und Kurven.
 *
 * Jeder Punkt wird dauerhaft gespeichert; vorhandene Punkte bleiben beim
 * Hinzufügen weiterer Punkte unverändert erhalten. Rohdaten werden nie verändert.
 */
export default function CurvePointEvaluations({
  datasetId, dataset, xKey, yKeys, records, onChanged, readOnly,
}: Props) {
  const [xValue, setXValue] = useState<string>("");
  const [comment, setComment] = useState("");
  const [selected, setSelected] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const xChannel = findChannel(dataset, xKey);
  const candidates = useMemo(
    () => dataset.channels.filter((c) => c.key !== xKey),
    [dataset, xKey]
  );
  const activeCurves = selected ?? (yKeys.length ? yKeys : candidates.slice(0, 1).map((c) => c.key));

  const groups = useMemo(() => groupPointEvaluations(records), [records]);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const base = prev ?? activeCurves;
      return base.includes(key) ? base.filter((k) => k !== key) : [...base, key];
    });

  const addPoint = async () => {
    const x = Number(String(xValue).replace(",", "."));
    if (!Number.isFinite(x)) {
      toast.error("Bitte einen gültigen X-Wert eingeben.");
      return;
    }
    if (activeCurves.length === 0) {
      toast.error("Bitte mindestens eine Kurve auswählen.");
      return;
    }
    const curves = activeCurves.map((key) => {
      const ch = findChannel(dataset, key);
      return {
        y_channel: key,
        y_label: ch?.label ?? key,
        y_unit: ch?.unit ?? null,
        value: interpolateAt(curveOf(dataset, xKey, key), x),
      };
    });
    if (curves.every((c) => c.value == null)) {
      toast.error("Die gewählte Stelle liegt außerhalb der Messdaten.");
      return;
    }
    setBusy(true);
    try {
      await api.measurementRawData.saveEvaluationPoint({
        dataset_id: datasetId,
        x_channel: xKey,
        x_label: xChannel?.label ?? xKey,
        x_unit: xChannel?.unit ?? null,
        x_at: x,
        comment: comment.trim() || null,
        curves,
      });
      setXValue("");
      setComment("");
      onChanged();
      toast.success("Auswertungspunkt gespeichert.");
    } catch (e) {
      toast.error(`Speichern fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const removeGroup = async (groupKey: string, rows: CurveEvaluationRecord[]) => {
    setBusy(true);
    try {
      if (rows[0]?.group_id) await api.measurementRawData.deleteEvaluationGroup(rows[0].group_id);
      else await api.measurementRawData.deleteEvaluation(rows[0].id);
      onChanged();
      toast.success("Auswertungspunkt gelöscht.");
    } catch (e) {
      toast.error(`Löschen fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const toggleReport = async (groupKey: string, rows: CurveEvaluationRecord[], next: boolean) => {
    try {
      if (rows[0]?.group_id) await api.measurementRawData.updateEvaluationGroup(rows[0].group_id, { include_in_report: next });
      else await api.measurementRawData.updateEvaluation(rows[0].id, { include_in_report: next });
      onChanged();
    } catch (e) {
      toast.error(`Änderung fehlgeschlagen: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="rounded border p-3 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">
                {xChannel?.label ?? "X"}{xChannel?.unit ? ` [${xChannel.unit}]` : ""}
              </Label>
              <Input
                className="h-8 w-36"
                inputMode="decimal"
                placeholder="z. B. 850"
                value={xValue}
                onChange={(e) => setXValue(e.target.value)}
              />
            </div>
            <div className="space-y-1 flex-1 min-w-48">
              <Label className="text-xs">Kommentar (optional)</Label>
              <Input className="h-8" value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
            <Button type="button" size="sm" disabled={busy} onClick={() => void addPoint()}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Auswertungspunkt hinzufügen
            </Button>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Label className="text-xs">Auszuwertende Kurven</Label>
              <button
                type="button"
                className="text-[11px] underline text-muted-foreground"
                onClick={() => setSelected(candidates.map((c) => c.key))}
              >
                alle Kurven
              </button>
              <button
                type="button"
                className="text-[11px] underline text-muted-foreground"
                onClick={() => setSelected(yKeys)}
              >
                dargestellte Kurven
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              {candidates.map((c) => (
                <label key={c.key} className="flex items-center gap-1.5 text-xs">
                  <Checkbox checked={activeCurves.includes(c.key)} onCheckedChange={() => toggle(c.key)} />
                  <span>{c.label}{c.unit ? ` [${c.unit}]` : ""}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">Noch keine Auswertungspunkte gespeichert.</p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.key} className="rounded border">
              <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-3 py-2">
                <Badge variant="secondary">
                  {g.rows[0].x_label ?? g.rows[0].x_channel}: {fmt(g.x)}{g.rows[0].x_unit ? ` ${g.rows[0].x_unit}` : ""}
                </Badge>
                {g.comment && <span className="text-xs text-muted-foreground">{g.comment}</span>}
                <span className="text-[11px] text-muted-foreground">
                  {new Date(g.rows[0].created_at).toLocaleString("de-AT")}
                  {g.rows[0].revision > 1 ? ` · geändert (Rev. ${g.rows[0].revision})` : ""}
                </span>
                <label className="ml-auto flex items-center gap-1.5 text-[11px]">
                  <Checkbox
                    checked={g.includeInReport}
                    disabled={readOnly}
                    onCheckedChange={(v) => void toggleReport(g.key, g.rows, Boolean(v))}
                  />
                  im Ergebnisbericht
                </label>
                {!readOnly && (
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7"
                    disabled={busy} onClick={() => void removeGroup(g.key, g.rows)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-1.5">Kurve</th>
                    <th className="text-left px-3 py-1.5">X</th>
                    <th className="text-left px-3 py-1.5">Y</th>
                    <th className="text-left px-3 py-1.5">Einheit</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-1.5">{r.y_label ?? r.y_channel}</td>
                      <td className="px-3 py-1.5">{fmt(Number(r.x_at ?? r.x_from))}{r.x_unit ? ` ${r.x_unit}` : ""}</td>
                      <td className="px-3 py-1.5 font-mono">{fmt(r.value == null ? null : Number(r.value))}</td>
                      <td className="px-3 py-1.5">{r.unit ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
