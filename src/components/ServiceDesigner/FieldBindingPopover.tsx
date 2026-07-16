import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Link2, Link2Off } from "lucide-react";
import type { BindingSource, FieldBinding } from "@/lib/api/serviceFormLayouts";
import { BINDING_PRESETS } from "@/lib/api/serviceFormLayouts";

interface Props {
  binding?: FieldBinding;
  onChange: (b: FieldBinding | undefined) => void;
  disabled?: boolean;
}

const SOURCES = Object.keys(BINDING_PRESETS) as BindingSource[];

const SOURCE_GROUPS: { label: string; sources: BindingSource[] }[] = [
  { label: "Auftrag & Kontext", sources: ["order", "project", "sample"] },
  { label: "Formulardaten", sources: ["customer_form", "employee_form"] },
  { label: "Messungen", sources: ["measurement_parameter", "measurement_result"] },
  { label: "Prozess & Ressourcen", sources: ["workflow", "raw_material", "service", "worklog", "attachment"] },
  { label: "Sonstiges", sources: ["system", "computed", "free"] },
];

export default function FieldBindingPopover({ binding, onChange, disabled }: Props) {
  const active = !!binding;
  const src = binding?.source;
  const presets = src ? BINDING_PRESETS[src].presets : [];

  const setSource = (s: BindingSource) => {
    onChange({ source: s, path: "", editable: binding?.editable ?? false });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant={active ? "secondary" : "ghost"}
          className="h-6 gap-1 text-[10px] px-2"
          title="Datenquellen-Verknüpfung"
        >
          {active ? <Link2 className="h-3 w-3 text-primary" /> : <Link2Off className="h-3 w-3" />}
          {active
            ? <>{BINDING_PRESETS[binding!.source].label}{binding?.path ? ` · ${binding.path}` : ""}</>
            : "Datenquelle"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 space-y-3" align="end">
        <div>
          <p className="text-sm font-medium">Datenquellen-Verknüpfung</p>
          <p className="text-[11px] text-muted-foreground">
            Wird beim Erstellen des Ergebnisberichts automatisch mit den aktuellen Daten befüllt.
            Auf anderen Formularen wird die Verknüpfung ignoriert.
          </p>
        </div>

        {active && (
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Datenquelle</Label>
              <Select value={src} disabled={disabled} onValueChange={(v) => setSource(v as BindingSource)}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {SOURCE_GROUPS.map((g) => (
                    <div key={g.label}>
                      <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {g.label}
                      </div>
                      {g.sources.map((s) => (
                        <SelectItem key={s} value={s}>{BINDING_PRESETS[s].label}</SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {presets.length > 0 && (
              <div>
                <Label className="text-xs">Vordefinierte Felder</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {presets.map((p) => (
                    <Badge
                      key={p.path}
                      variant={binding?.path === p.path ? "default" : "outline"}
                      className="cursor-pointer text-[10px]"
                      onClick={() => !disabled && onChange({ ...binding!, path: p.path })}
                    >
                      {p.label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs">
                Feldschlüssel / Pfad{src === "computed" ? " (Formel)" : ""}
              </Label>
              <Input
                value={binding?.path ?? ""}
                disabled={disabled}
                onChange={(e) => onChange({ ...binding!, path: e.target.value })}
                placeholder={
                  src === "computed" ? "z.B. sum(measurement_result.value)" :
                  src === "customer_form" || src === "employee_form" ? "field_key aus dem Formular" :
                  "z.B. order_number"
                }
                className="h-8 font-mono text-xs"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={!!binding?.editable}
                disabled={disabled}
                onCheckedChange={(c) => onChange({ ...binding!, editable: !!c })}
              />
              Nachträgliche Bearbeitung im Bericht erlauben
            </label>
          </div>
        )}

        <div className="flex justify-between pt-2 border-t">
          {active ? (
            <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onChange(undefined)}>
              Verknüpfung entfernen
            </Button>
          ) : (
            <Button size="sm" disabled={disabled} onClick={() => onChange({ source: "order", path: "", editable: false })}>
              Verknüpfung hinzufügen
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
