import { useEffect, useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, FileDown, History } from "lucide-react";
import { toast } from "sonner";
import { useLabelTemplates, useLogPrintHistory, usePrintHistoryByContainer } from "@/hooks/useLabelTemplates";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useAuth } from "@/contexts/AuthContext";
import { LabelRenderer, LABEL_MM_TO_PX } from "./LabelRenderer";
import { LabelDataContext } from "@/lib/labels/fields";
import { ghsKeysFromHazardCategories } from "@/lib/labels/symbols";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  container: any;
  material: any;
  batch?: any;
  location?: any;
}

export function PrintLabelDialog({ open, onOpenChange, container, material, batch, location }: Props) {
  const { data: templates = [] } = useLabelTemplates();
  const { data: company } = useCompanySettings();
  const { user } = useAuth();
  const logPrint = useLogPrintHistory();
  const { data: history = [] } = usePrintHistoryByContainer(container?.id);

  const [templateId, setTemplateId] = useState<string>("");
  const [copies, setCopies] = useState(1);
  const [showHistory, setShowHistory] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Pick default template (category=rohstoff is_default) on first open
  useEffect(() => {
    if (!open || templateId) return;
    const def =
      templates.find((t) => t.is_default && t.category === (material?.is_hazardous ? "gefahrstoff" : "rohstoff")) ||
      templates.find((t) => t.is_default) ||
      templates[0];
    if (def) setTemplateId(def.id);
  }, [open, templates, templateId, material]);

  const template = templates.find((t) => t.id === templateId);

  const data: LabelDataContext = useMemo(() => ({
    material,
    container,
    batch,
    location,
    company: { name: company?.company_name, address: null, logo_data_url: company?.logo_data_url },
    hazardGhsKeys: ghsKeysFromHazardCategories(material?.hazard_categories),
    psaKeys: Array.isArray(material?.psa_categories) ? (material.psa_categories as string[]) : [],
  }), [material, container, batch, location, company]);

  async function doPrint() {
    if (!template) return;
    const wMM = template.width_mm;
    const hMM = template.height_mm;
    const labelHtml = printAreaRef.current?.querySelector("[data-label-print]")?.outerHTML || "";
    const win = window.open("", "_blank", "width=600,height=600");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etikett ${container?.container_code ?? ""}</title>
<style>
  @page { size: ${wMM}mm ${hMM}mm; margin: 0; }
  html,body { margin:0; padding:0; }
  .pg { width:${wMM}mm; height:${hMM}mm; page-break-after: always; overflow:hidden; }
  .pg:last-child { page-break-after: auto; }
</style></head><body>
${Array.from({ length: copies }, () => `<div class="pg">${labelHtml}</div>`).join("")}
<script>window.onload=()=>{setTimeout(()=>{window.print();},250);};</script>
</body></html>`);
    win.document.close();

    await logPrint.mutateAsync({
      template_id: template.id,
      container_id: container?.id ?? null,
      raw_material_id: material?.id ?? null,
      copies,
      output: "print",
      data_snapshot: { container, material_name: material?.material_name, batch: batch?.lot_number ?? batch?.batch_number },
      printed_by: user?.id ?? null,
    });
    toast.success("Druckauftrag gesendet");
  }

  async function doPdf() {
    if (!template || !printAreaRef.current) return;
    const node = printAreaRef.current.querySelector("[data-label-print]") as HTMLElement | null;
    if (!node) return;
    const canvas = await html2canvas(node, { scale: 3, backgroundColor: "#ffffff", logging: false });
    const pdf = new jsPDF({ orientation: template.width_mm > template.height_mm ? "landscape" : "portrait", unit: "mm", format: [template.width_mm, template.height_mm] });
    const img = canvas.toDataURL("image/png");
    for (let i = 0; i < copies; i++) {
      if (i > 0) pdf.addPage([template.width_mm, template.height_mm], template.width_mm > template.height_mm ? "landscape" : "portrait");
      pdf.addImage(img, "PNG", 0, 0, template.width_mm, template.height_mm);
    }
    pdf.save(`etikett_${container?.container_code ?? "label"}.pdf`);

    await logPrint.mutateAsync({
      template_id: template.id,
      container_id: container?.id ?? null,
      raw_material_id: material?.id ?? null,
      copies,
      output: "pdf",
      data_snapshot: { container_code: container?.container_code, material_name: material?.material_name },
      printed_by: user?.id ?? null,
    });
    toast.success("PDF erstellt");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Etikett drucken</DialogTitle>
          <DialogDescription>Vorlage wählen, Stückzahl festlegen und drucken oder als PDF speichern.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[1fr_220px] gap-4">
          <div>
            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <Label className="text-xs">Vorlage</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Vorlage wählen…" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name} · {t.category} · {t.width_mm}×{t.height_mm}mm{t.is_default ? " · ★" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Anzahl</Label>
                <Input type="number" min={1} max={500} className="h-9 w-24" value={copies} onChange={(e) => setCopies(Math.max(1, Number(e.target.value)))} />
              </div>
            </div>

            <div ref={printAreaRef} className="rounded-md border bg-muted/30 p-3 flex items-center justify-center min-h-[260px] overflow-auto">
              {template ? (
                <div data-label-print>
                  <LabelRenderer template={template} data={data} scale={2} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Bitte Vorlage wählen.</p>
              )}
            </div>
            {template && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Größe: {template.width_mm} × {template.height_mm} mm · Vorschau 2× ({Math.round(template.width_mm * LABEL_MM_TO_PX * 2)}×{Math.round(template.height_mm * LABEL_MM_TO_PX * 2)} px)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Button className="w-full" onClick={doPrint} disabled={!template}><Printer className="h-4 w-4 mr-1" /> Drucken</Button>
            <Button variant="outline" className="w-full" onClick={doPdf} disabled={!template}><FileDown className="h-4 w-4 mr-1" /> Als PDF</Button>
            <Button variant="ghost" className="w-full" onClick={() => setShowHistory((v) => !v)}><History className="h-4 w-4 mr-1" /> Historie ({history.length})</Button>
            {showHistory && (
              <ScrollArea className="h-48 border rounded-md p-2">
                {history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Noch keine Drucke.</p>
                ) : history.map((h) => (
                  <div key={h.id} className="text-xs py-1 border-b last:border-0">
                    {new Date(h.printed_at).toLocaleString("de-DE")} · {h.copies}× · {h.output}
                  </div>
                ))}
              </ScrollArea>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Schließen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
