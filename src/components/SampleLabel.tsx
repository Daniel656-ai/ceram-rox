import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Printer } from "lucide-react";
import { useCompanyLogo } from "@/hooks/useCompanySettings";

interface SampleLabelProps {
  sample: {
    sample_number: string;
    sample_name: string;
    description: string;
    created_at: string;
    is_hazardous: boolean;
    hazard_categories: string[];
    id: string;
  };
  baseUrl?: string;
}

type LabelSize = "small" | "medium" | "large";

const LABEL_SIZES: Record<LabelSize, { width: string; height: string; label: string }> = {
  small: { width: "50mm", height: "25mm", label: "label_small" },
  medium: { width: "70mm", height: "40mm", label: "label_medium" },
  large: { width: "100mm", height: "60mm", label: "label_large" },
};

export function SampleBarcode({ sampleNumber, label }: { sampleNumber: string; label?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, sampleNumber, {
          format: "CODE128",
          width: 1.5,
          height: 40,
          displayValue: true,
          fontSize: 12,
          margin: 4,
        });
      } catch (e) {
        console.error("Barcode generation error", e);
      }
    }
  }, [sampleNumber]);

  return (
    <div className="text-center">
      <svg ref={svgRef} />
      {label && <p className="text-xs text-muted-foreground mt-0.5">{label}</p>}
    </div>
  );
}

export function SampleQRCode({ sampleId, label, size = 120 }: { sampleId: string; sampleNumber?: string; label?: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const url = `${window.location.origin}/proben/${sampleId}`;

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: size,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      }).catch(console.error);
    }
  }, [url, size]);

  return (
    <div className="text-center">
      <canvas ref={canvasRef} />
      {label && <p className="text-xs text-muted-foreground mt-1">{label}</p>}
    </div>
  );
}

export function SampleLabelPrintDialog({ sample }: SampleLabelProps) {
  const { t } = useTranslation("samples");
  const [labelSize, setLabelSize] = useState<LabelSize>("medium");
  const [open, setOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank", "width=600,height=400");
    if (!printWindow) return;

    const content = printRef.current.innerHTML;
    const dims = LABEL_SIZES[labelSize];

    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>${t("print_label")} – ${sample.sample_number}</title>
      <style>
        @page { size: ${dims.width} ${dims.height}; margin: 0; }
        body { margin: 0; padding: 2mm; font-family: Arial, sans-serif; }
        .label { width: ${dims.width}; height: ${dims.height}; box-sizing: border-box; overflow: hidden; }
        .label-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2mm; }
        .label-id { font-weight: bold; font-size: ${labelSize === "small" ? "8pt" : "10pt"}; }
        .label-name { font-size: ${labelSize === "small" ? "6pt" : "8pt"}; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70%; }
        .label-codes { display: flex; gap: 2mm; align-items: center; justify-content: center; margin: 1mm 0; }
        .label-codes canvas { max-width: ${labelSize === "small" ? "50px" : "80px"}; max-height: ${labelSize === "small" ? "50px" : "80px"}; }
        .label-codes svg { max-width: ${labelSize === "small" ? "80px" : "140px"}; max-height: ${labelSize === "small" ? "25px" : "40px"}; }
        .label-footer { display: flex; justify-content: space-between; font-size: 6pt; color: #888; }
        .hazard-badge { background: #dc2626; color: white; font-size: 6pt; padding: 0.5mm 1.5mm; border-radius: 1mm; display: inline-flex; align-items: center; gap: 1mm; }
      </style>
      </head><body>${content}
      <script>window.onload=function(){window.print();window.close();}</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Printer className="h-4 w-4 mr-1" />{t("print_label")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t("print_label")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("label_size")}</label>
            <Select value={labelSize} onValueChange={(v) => setLabelSize(v as LabelSize)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="small">{t("label_small")}</SelectItem>
                <SelectItem value="medium">{t("label_medium")}</SelectItem>
                <SelectItem value="large">{t("label_large")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          <div className="border rounded-md p-4 bg-white">
            <div ref={printRef}>
              <div className="label">
                <div className="label-header">
                  <span className="label-id">{sample.sample_number}</span>
                  {sample.is_hazardous && (
                    <span className="hazard-badge">
                      ⚠ {(sample.hazard_categories || []).map(c => t(`hazard_${c}`)).join(", ")}
                    </span>
                  )}
                </div>
                <div className="label-name" style={{ fontSize: "0.8rem", color: "#555", marginBottom: "4px" }}>
                  {sample.sample_name}
                </div>
                <div className="label-codes" style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "center" }}>
                  <SampleQRCode sampleId={sample.id} sampleNumber={sample.sample_number} size={labelSize === "small" ? 60 : 90} />
                  <SampleBarcode sampleNumber={sample.sample_number} />
                </div>
                <div className="label-footer" style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "#999", marginTop: "4px" }}>
                  <span>{new Date(sample.created_at).toLocaleDateString("de-DE")}</span>
                  <span>{sample.sample_number}</span>
                </div>
              </div>
            </div>
          </div>

          <Button onClick={handlePrint} className="w-full">
            <Printer className="h-4 w-4 mr-2" />{t("print_label")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
