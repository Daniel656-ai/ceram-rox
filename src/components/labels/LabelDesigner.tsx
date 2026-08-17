import { useMemo, useState } from "react";
import { Rnd } from "react-rnd";
import type { LabelElement, LabelLayout, LabelTemplate } from "@/lib/api/labelTemplates";
import { LABEL_FIELDS, LabelDataContext, PRESET_SIZES, LABEL_CATEGORIES, resolveField } from "@/lib/labels/fields";
import { useMergedSymbols } from "@/hooks/useMergedSymbols";
import { LabelRenderer, LABEL_MM_TO_PX } from "./LabelRenderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Trash2, Type, Hash, QrCode, Barcode, Image as ImageIcon, ShieldAlert, HardHat, Square as SquareIcon } from "lucide-react";

interface Props {
  value: { name: string; category: string; width_mm: number; height_mm: number; layout: LabelLayout; is_default?: boolean };
  sampleData: LabelDataContext;
  onChange: (patch: Partial<Props["value"]>) => void;
}

function uid() { return Math.random().toString(36).slice(2, 10); }

export function LabelDesigner({ value, sampleData, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const layout = value.layout;
  const selected = layout.elements.find((e) => e.id === selectedId) || null;
  const previewScale = 2; // designer canvas at 2× for editing comfort
  const ghsSymbols = useMergedSymbols("ghs");
  const psaSymbols = useMergedSymbols("psa");

  const update = (patch: Partial<typeof value>) => onChange(patch);
  const updateLayout = (mut: (l: LabelLayout) => LabelLayout) => update({ layout: mut(layout) });

  const addElement = (el: Omit<LabelElement, "id">) => {
    const next: LabelElement = { id: uid(), ...el };
    updateLayout((l) => ({ ...l, elements: [...l.elements, next] }));
    setSelectedId(next.id);
  };

  const patchEl = (id: string, patch: Partial<LabelElement>) =>
    updateLayout((l) => ({
      ...l,
      elements: l.elements.map((e) => {
        if (e.id !== id) return e;
        const next = { ...e, ...patch } as LabelElement;
        // QR-Codes bleiben quadratisch – die zuletzt geänderte Kante gewinnt.
        if (next.type === "qrcode") {
          if (patch.w !== undefined) next.h = patch.w;
          else if (patch.h !== undefined) next.w = patch.h;
        }
        return next;
      }),
    }));


  const removeEl = (id: string) => {
    updateLayout((l) => ({ ...l, elements: l.elements.filter((e) => e.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  };

  const fieldGroups = useMemo(() => {
    const g: Record<string, typeof LABEL_FIELDS> = {};
    LABEL_FIELDS.forEach((f) => { (g[f.group] ||= []).push(f); });
    return g;
  }, []);

  return (
    <div className="grid grid-cols-[260px_1fr_300px] gap-4 h-[calc(100vh-260px)] min-h-[520px]">
      {/* Left: palette */}
      <Card className="p-3 overflow-auto">
        <h3 className="text-sm font-semibold mb-2">Elemente</h3>
        <Tabs defaultValue="fields">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="fields">Felder</TabsTrigger>
            <TabsTrigger value="extras">Extras</TabsTrigger>
          </TabsList>
          <TabsContent value="fields" className="space-y-3 mt-3">
            {Object.entries(fieldGroups).map(([grp, list]) => (
              <div key={grp}>
                <p className="text-xs font-semibold text-muted-foreground mb-1">{grp}</p>
                <div className="space-y-1">
                  {list.map((f) => (
                    <Button
                      key={f.key}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-xs"
                      onClick={() => addElement({ type: "field", field: f.key, x: 2, y: 2, w: 40, h: 6, fontSize: 8 })}
                    >
                      <Type className="h-3 w-3 mr-1" />{f.label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="extras" className="space-y-1 mt-3">
            <Button variant="outline" size="sm" className="w-full justify-start text-xs"
              onClick={() => addElement({ type: "static_text", text: "Eigener Text", x: 2, y: 2, w: 40, h: 6, fontSize: 9 })}>
              <Type className="h-3 w-3 mr-1" />Freitext
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start text-xs"
              onClick={() => addElement({ type: "barcode", source: "container.container_code", barcodeFormat: "CODE128", x: 2, y: 2, w: 50, h: 12 })}>
              <Barcode className="h-3 w-3 mr-1" />Barcode
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start text-xs"
              onClick={() => addElement({ type: "qrcode", source: "container.container_code", x: 2, y: 2, w: 18, h: 18 })}>
              <QrCode className="h-3 w-3 mr-1" />QR-Code
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start text-xs"
              onClick={() => addElement({ type: "logo", x: 2, y: 2, w: 25, h: 10 })}>
              <ImageIcon className="h-3 w-3 mr-1" />Firmenlogo
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start text-xs"
              onClick={() => addElement({ type: "ghs", auto: true, x: 2, y: 2, w: 35, h: 12 })}>
              <ShieldAlert className="h-3 w-3 mr-1" />GHS-Symbole (auto)
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start text-xs"
              onClick={() => addElement({ type: "psa", auto: true, x: 2, y: 2, w: 35, h: 12 })}>
              <HardHat className="h-3 w-3 mr-1" />PSA-Symbole (auto)
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start text-xs"
              onClick={() => addElement({ type: "rect", x: 2, y: 2, w: 30, h: 10, border: "#000", borderWidth: 0.5, bg: "transparent" })}>
              <SquareIcon className="h-3 w-3 mr-1" />Rechteck / Linie
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start text-xs"
              onClick={() => addElement({ type: "line", x: 2, y: 2, w: 40, h: 0.3, color: "#000" })}>
              <Hash className="h-3 w-3 mr-1" />Trennlinie
            </Button>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Center: canvas */}
      <Card className="p-4 overflow-auto bg-muted/30">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={value.name} onChange={(e) => update({ name: e.target.value })} className="h-8 w-44" />
          </div>
          <div>
            <Label className="text-xs">Kategorie</Label>
            <Select value={value.category} onValueChange={(v) => update({ category: v })}>
              <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LABEL_CATEGORIES.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Größe</Label>
            <Select value={`${value.width_mm}x${value.height_mm}`} onValueChange={(v) => {
              const [w, h] = v.split("x").map(Number); update({ width_mm: w, height_mm: h });
            }}>
              <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESET_SIZES.map((p) => <SelectItem key={p.label} value={`${p.w}x${p.h}`}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <div><Label className="text-xs">B (mm)</Label><Input type="number" className="h-8 w-20" value={value.width_mm} onChange={(e) => update({ width_mm: Number(e.target.value) })} /></div>
            <div><Label className="text-xs">H (mm)</Label><Input type="number" className="h-8 w-20" value={value.height_mm} onChange={(e) => update({ height_mm: Number(e.target.value) })} /></div>
          </div>
          <div>
            <Label className="text-xs">Hintergrund</Label>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                className="h-8 w-16 p-1"
                value={layout.background || "#ffffff"}
                onChange={(e) => updateLayout((l) => ({ ...l, background: e.target.value }))}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => updateLayout((l) => ({ ...l, background: "#ffffff" }))}
              >
                Weiß
              </Button>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <Switch id="def" checked={!!value.is_default} onCheckedChange={(v) => update({ is_default: v })} />
            <Label htmlFor="def" className="text-xs">Standardvorlage</Label>
          </div>
        </div>

        <div
          className="relative mx-auto border border-border shadow-sm"
          style={{
            width: value.width_mm * LABEL_MM_TO_PX * previewScale,
            height: value.height_mm * LABEL_MM_TO_PX * previewScale,
            background: layout.background || "#ffffff",
          }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
        >
          {/* underlying renderer for visual content */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <LabelRenderer template={{ width_mm: value.width_mm, height_mm: value.height_mm, layout: { ...layout, elements: layout.elements } }} data={sampleData} scale={previewScale} placeholder />
          </div>
          {/* overlay drag handles */}
          {layout.elements.map((el) => {
            const px = LABEL_MM_TO_PX * previewScale;
            return (
              <Rnd
                key={el.id}
                bounds="parent"
                size={{ width: el.w * px, height: el.h * px }}
                position={{ x: el.x * px, y: el.y * px }}
                onClick={() => setSelectedId(el.id)}
                onDragStop={(_, d) => patchEl(el.id, { x: Math.max(0, d.x / px), y: Math.max(0, d.y / px) })}
                onResizeStop={(_, __, ref, ___, pos) =>
                  patchEl(el.id, {
                    w: parseFloat(ref.style.width) / px,
                    h: parseFloat(ref.style.height) / px,
                    x: Math.max(0, pos.x / px),
                    y: Math.max(0, pos.y / px),
                  })
                }
                style={{
                  border: selectedId === el.id ? "1.5px solid hsl(var(--primary))" : "1px dashed rgba(0,0,0,0.15)",
                  background: "transparent",
                  cursor: "move",
                }}
              />
            );
          })}
        </div>
      </Card>

      {/* Right: properties */}
      <Card className="p-3 overflow-auto">
        <h3 className="text-sm font-semibold mb-2">Eigenschaften</h3>
        {!selected ? (
          <p className="text-xs text-muted-foreground">Element auswählen, um Eigenschaften zu bearbeiten.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase text-muted-foreground">{selected.type}</span>
              <Button size="icon" variant="ghost" onClick={() => removeEl(selected.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">X (mm)</Label><Input type="number" step="0.5" className="h-8" value={selected.x} onChange={(e) => patchEl(selected.id, { x: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Y (mm)</Label><Input type="number" step="0.5" className="h-8" value={selected.y} onChange={(e) => patchEl(selected.id, { y: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">B (mm)</Label><Input type="number" step="0.5" className="h-8" value={selected.w} onChange={(e) => patchEl(selected.id, { w: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">H (mm)</Label><Input type="number" step="0.5" className="h-8" value={selected.h} onChange={(e) => patchEl(selected.id, { h: Number(e.target.value) })} /></div>
            </div>

            {(selected.type === "field" || selected.type === "static_text") && (
              <>
                {selected.type === "field" && (
                  <div>
                    <Label className="text-xs">Feld</Label>
                    <Select value={selected.field || ""} onValueChange={(v) => patchEl(selected.id, { field: v })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {LABEL_FIELDS.map((f) => <SelectItem key={f.key} value={f.key}>{f.group} · {f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground mt-1">Vorschau: {resolveField(selected.field || "", sampleData) || "—"}</p>
                  </div>
                )}
                {selected.type === "static_text" && (
                  <div><Label className="text-xs">Text</Label><Input className="h-8" value={selected.text || ""} onChange={(e) => patchEl(selected.id, { text: e.target.value })} /></div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-xs">Größe (pt)</Label><Input type="number" className="h-8" value={selected.fontSize || 9} onChange={(e) => patchEl(selected.id, { fontSize: Number(e.target.value) })} /></div>
                  <div><Label className="text-xs">Gewicht</Label>
                    <Select value={selected.fontWeight || "normal"} onValueChange={(v: any) => patchEl(selected.id, { fontWeight: v })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="normal">normal</SelectItem><SelectItem value="bold">bold</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Ausrichtung</Label>
                    <Select value={selected.align || "left"} onValueChange={(v: any) => patchEl(selected.id, { align: v })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="left">links</SelectItem><SelectItem value="center">zentriert</SelectItem><SelectItem value="right">rechts</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label className="text-xs">Farbe</Label><Input type="color" className="h-8 w-20 p-1" value={selected.color || "#111111"} onChange={(e) => patchEl(selected.id, { color: e.target.value })} /></div>
              </>
            )}

            {(selected.type === "barcode" || selected.type === "qrcode") && (
              <>
                <div>
                  <Label className="text-xs">Quelle (Feld)</Label>
                  <Select value={selected.source || ""} onValueChange={(v) => patchEl(selected.id, { source: v })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {LABEL_FIELDS.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {selected.type === "barcode" && (
                  <div>
                    <Label className="text-xs">Format</Label>
                    <Select value={selected.barcodeFormat || "CODE128"} onValueChange={(v: any) => patchEl(selected.id, { barcodeFormat: v })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CODE128">Code 128</SelectItem>
                        <SelectItem value="CODE39">Code 39</SelectItem>
                        <SelectItem value="EAN13">EAN-13</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            {(selected.type === "ghs" || selected.type === "psa") && (
              <>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Aus Stammdaten übernehmen</Label>
                  <Switch checked={!!selected.auto} onCheckedChange={(v) => patchEl(selected.id, { auto: v })} />
                </div>
                {!selected.auto && (
                  <div className="space-y-1 max-h-48 overflow-auto pr-1">
                    {(selected.type === "ghs" ? ghsSymbols : psaSymbols).map((s) => {
                      const checked = (selected.symbols || []).includes(s.key);
                      return (
                        <label key={s.key} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input type="checkbox" checked={checked} onChange={(e) => {
                            const cur = new Set(selected.symbols || []);
                            if (e.target.checked) cur.add(s.key); else cur.delete(s.key);
                            patchEl(selected.id, { symbols: Array.from(cur) });
                          }} />
                          <img src={s.src} alt="" className="h-5 w-5" />
                          <span>{s.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {selected.type === "rect" && (
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Hintergrund</Label><Input type="color" className="h-8 w-20 p-1" value={selected.bg && selected.bg !== "transparent" ? selected.bg : "#ffffff"} onChange={(e) => patchEl(selected.id, { bg: e.target.value })} /></div>
                <div><Label className="text-xs">Rahmen</Label><Input type="color" className="h-8 w-20 p-1" value={selected.border || "#000000"} onChange={(e) => patchEl(selected.id, { border: e.target.value })} /></div>
                <div><Label className="text-xs">Rahmen (mm)</Label><Input type="number" step="0.1" className="h-8" value={selected.borderWidth ?? 0.5} onChange={(e) => patchEl(selected.id, { borderWidth: Number(e.target.value) })} /></div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
