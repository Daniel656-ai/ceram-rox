import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, PackageSearch } from "lucide-react";
import { useRawMaterials } from "@/hooks/useRawMaterials";
import {
  SAMPLE_CATEGORIES,
  categoryHasV2O5,
  type SampleParameters,
} from "@/lib/sampleParameters";

interface Props {
  value: SampleParameters;
  onChange: (next: SampleParameters) => void;
  idPrefix?: string;
}

/**
 * Dynamische Eingabemaske für auftragsspezifische Probenparameter.
 * Die Sichtbarkeit des V₂O₅-Feldes wird über die Kategorie gesteuert.
 */
export function SampleParametersFields({ value, onChange, idPrefix = "sp" }: Props) {
  const { t } = useTranslation("samples");
  const { data: rawMaterials = [] } = useRawMaterials();
  const [rmOpen, setRmOpen] = useState(false);
  const [rmQuery, setRmQuery] = useState("");

  const showV2O5 = categoryHasV2O5(value.category);

  const set = (patch: Partial<SampleParameters>) => onChange({ ...value, ...patch });

  const options = useMemo(
    () =>
      (rawMaterials as any[]).map((m) => ({
        id: m.id as string,
        code: (m.material_number || m.material_name) as string,
        name: m.material_name as string,
      })),
    [rawMaterials]
  );

  const filtered = useMemo(() => {
    const q = rmQuery.trim().toLowerCase();
    if (!q) return options.slice(0, 50);
    return options
      .filter((o) => o.code?.toLowerCase().includes(q) || o.name?.toLowerCase().includes(q))
      .slice(0, 50);
  }, [options, rmQuery]);

  const selectedLabel = value.raw_material_code || t("raw_material_code_placeholder");

  return (
    <div className="space-y-4 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <PackageSearch className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">{t("params_section")}</h4>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("category")}</Label>
          <Select
            value={value.category || "__none__"}
            onValueChange={(v) => {
              const category = v === "__none__" ? "" : v;
              set({
                category,
                v2o5_content: categoryHasV2O5(category) ? value.v2o5_content : "0.00",
              });
            }}
          >
            <SelectTrigger id={`${idPrefix}-category`}>
              <SelectValue placeholder={t("select_category")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{t("no_category")}</SelectItem>
              {SAMPLE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{t(`category_${c}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t("v2o5_content")}</Label>
          {showV2O5 ? (
            <Input
              id={`${idPrefix}-v2o5`}
              type="number"
              step="0.01"
              min="0"
              value={value.v2o5_content}
              onChange={(e) => set({ v2o5_content: e.target.value })}
              placeholder="0,00"
            />
          ) : (
            <div className="flex h-10 items-center gap-2 rounded-md border bg-muted/50 px-3">
              <span className="text-sm text-muted-foreground">0,00 %</span>
              <Badge variant="outline" className="text-[10px]">{t("v2o5_auto_zero")}</Badge>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>{t("operating_hours")}</Label>
          <Input
            id={`${idPrefix}-hours`}
            type="number"
            step="1"
            min="0"
            value={value.operating_hours}
            onChange={(e) => set({ operating_hours: e.target.value })}
            placeholder="0"
          />
        </div>

        <div className="space-y-2">
          <Label>{t("lot_number")}</Label>
          <Input
            id={`${idPrefix}-lot`}
            value={value.lot_number}
            onChange={(e) => set({ lot_number: e.target.value })}
          />
        </div>

        <div className="space-y-2 col-span-2">
          <Label>{t("raw_material_code")}</Label>
          <Popover open={rmOpen} onOpenChange={setRmOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={rmOpen}
                className="w-full justify-between font-normal"
              >
                <span className={value.raw_material_code ? "" : "text-muted-foreground"}>
                  {selectedLabel}
                </span>
                <ChevronsUpDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder={t("raw_material_search")}
                  value={rmQuery}
                  onValueChange={setRmQuery}
                />
                <CommandList>
                  <CommandEmpty className="p-3 text-sm text-muted-foreground">
                    {t("raw_material_none")}
                  </CommandEmpty>
                  {rmQuery.trim() && (
                    <CommandGroup heading={t("raw_material_external")}>
                      <CommandItem
                        value={`__external__${rmQuery}`}
                        onSelect={() => {
                          set({ raw_material_id: "", raw_material_code: rmQuery.trim() });
                          setRmOpen(false);
                        }}
                      >
                        <span className="truncate">"{rmQuery.trim()}" {t("raw_material_use_external")}</span>
                      </CommandItem>
                    </CommandGroup>
                  )}
                  <CommandGroup heading={t("raw_material_internal")}>
                    {filtered.map((o) => (
                      <CommandItem
                        key={o.id}
                        value={o.id}
                        onSelect={() => {
                          set({ raw_material_id: o.id, raw_material_code: o.code });
                          setRmOpen(false);
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${value.raw_material_id === o.id ? "opacity-100" : "opacity-0"}`}
                        />
                        <span className="truncate">
                          {o.code}
                          {o.name && o.name !== o.code ? ` – ${o.name}` : ""}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">
            {value.raw_material_id ? t("raw_material_linked") : t("raw_material_hint")}
          </p>
        </div>

        <div className="space-y-2">
          <Label>{t("bigbag_number")}</Label>
          <Input
            id={`${idPrefix}-bb`}
            value={value.bigbag_number}
            onChange={(e) => set({ bigbag_number: e.target.value })}
          />
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm" htmlFor={`${idPrefix}-used`}>
            <Checkbox
              id={`${idPrefix}-used`}
              checked={value.is_used_catalyst}
              onCheckedChange={(c) => set({ is_used_catalyst: !!c })}
            />
            {t("used_catalyst")}
          </label>
        </div>
      </div>
    </div>
  );
}
