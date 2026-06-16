import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  StepConditionKind,
  StepTimeMode,
  RelativeUnit,
  splitMinutes,
  toMinutes,
} from "@/lib/processTime";

export interface StepTimeValue {
  time_mode: StepTimeMode;
  offset_minutes: number | null;
  absolute_time: string | null;
  condition_kind: StepConditionKind | null;
  condition_value: number | null;
  condition_unit: string | null;
  condition_text: string | null;
}

export const defaultStepTime: StepTimeValue = {
  time_mode: "relative",
  offset_minutes: null,
  absolute_time: null,
  condition_kind: null,
  condition_value: null,
  condition_unit: null,
  condition_text: null,
};

interface Props {
  value: StepTimeValue;
  onChange: (v: StepTimeValue) => void;
}

export function StepTimePicker({ value, onChange }: Props) {
  const [unit, setUnit] = useState<RelativeUnit>("min");
  const [minStr, setMinStr] = useState("");
  const [hStr, setHStr] = useState("");

  // initialise from current offset_minutes
  useEffect(() => {
    if (value.time_mode === "relative") {
      const { h, m } = splitMinutes(value.offset_minutes);
      if (h && m) {
        setUnit("hm");
        setHStr(String(h));
        setMinStr(String(m));
      } else if (h) {
        setUnit("h");
        setHStr(String(h));
        setMinStr(String(h));
      } else {
        setUnit("min");
        setMinStr(value.offset_minutes != null ? String(value.offset_minutes) : "");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setRelative = (newUnit: RelativeUnit, v: string, h?: string) => {
    setUnit(newUnit);
    if (newUnit === "h") setHStr(v);
    else if (newUnit === "hm") {
      if (h !== undefined) setHStr(h);
      setMinStr(v);
    } else {
      setMinStr(v);
    }
    onChange({ ...value, time_mode: "relative", offset_minutes: toMinutes(v, newUnit, h ?? hStr) });
  };

  return (
    <div className="space-y-2">
      <Label>Zeitsteuerung</Label>
      <Tabs
        value={value.time_mode}
        onValueChange={(m) => onChange({ ...value, time_mode: m as StepTimeMode })}
      >
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="relative">Relativ</TabsTrigger>
          <TabsTrigger value="absolute">Uhrzeit</TabsTrigger>
          <TabsTrigger value="condition">Bedingung</TabsTrigger>
        </TabsList>

        <TabsContent value="relative" className="space-y-2 pt-2">
          <div className="flex gap-2 items-end">
            <div className="w-36">
              <Label className="text-xs">Einheit</Label>
              <Select value={unit} onValueChange={(u) => setRelative(u as RelativeUnit, minStr, hStr)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="min">Minuten</SelectItem>
                  <SelectItem value="h">Stunden</SelectItem>
                  <SelectItem value="hm">Stunden + Minuten</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {unit === "hm" ? (
              <>
                <div className="w-20">
                  <Label className="text-xs">Stunden</Label>
                  <Input type="number" value={hStr} onChange={(e) => setRelative("hm", minStr, e.target.value)} />
                </div>
                <div className="w-20">
                  <Label className="text-xs">Minuten</Label>
                  <Input type="number" value={minStr} onChange={(e) => setRelative("hm", e.target.value, hStr)} />
                </div>
              </>
            ) : (
              <div className="flex-1">
                <Label className="text-xs">{unit === "h" ? "Stunden" : "Minuten"}</Label>
                <Input
                  type="number"
                  step={unit === "h" ? "0.25" : "1"}
                  value={unit === "h" ? hStr : minStr}
                  onChange={(e) => setRelative(unit, e.target.value)}
                />
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Offset ab Chargenstart (z. B. „+30 min" oder „+2 h 15 min")
          </p>
        </TabsContent>

        <TabsContent value="absolute" className="space-y-2 pt-2">
          <Label className="text-xs">Uhrzeit (HH:MM)</Label>
          <Input
            type="time"
            value={(value.absolute_time || "").slice(0, 5)}
            onChange={(e) => onChange({ ...value, time_mode: "absolute", absolute_time: e.target.value || null })}
          />
          <p className="text-xs text-muted-foreground">Aktion zu fixer Tageszeit (z. B. 08:00 Uhr)</p>
        </TabsContent>

        <TabsContent value="condition" className="space-y-2 pt-2">
          <Label className="text-xs">Bedingung</Label>
          <Select
            value={value.condition_kind || ""}
            onValueChange={(k) =>
              onChange({
                ...value,
                time_mode: "condition",
                condition_kind: k as StepConditionKind,
                condition_unit:
                  k === "temperature" ? "°C" : k === "ph" ? "pH" : value.condition_unit,
              })
            }
          >
            <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="temperature">Temperatur erreicht</SelectItem>
              <SelectItem value="ph">pH-Wert erreicht</SelectItem>
              <SelectItem value="previous_step">Vorheriger Schritt beendet</SelectItem>
              <SelectItem value="manual_release">Freigabe durch Mitarbeiter</SelectItem>
              <SelectItem value="custom">Eigene Bedingung</SelectItem>
            </SelectContent>
          </Select>

          {(value.condition_kind === "temperature" || value.condition_kind === "ph") && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Schwelle</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={value.condition_value ?? ""}
                  onChange={(e) =>
                    onChange({ ...value, condition_value: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Einheit</Label>
                <Input
                  value={value.condition_unit || ""}
                  onChange={(e) => onChange({ ...value, condition_unit: e.target.value || null })}
                />
              </div>
            </div>
          )}

          {value.condition_kind === "custom" && (
            <div>
              <Label className="text-xs">Bedingungstext</Label>
              <Textarea
                rows={2}
                value={value.condition_text || ""}
                onChange={(e) => onChange({ ...value, condition_text: e.target.value || null })}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
