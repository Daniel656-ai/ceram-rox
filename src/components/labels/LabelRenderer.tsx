import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import type { LabelElement, LabelLayout, LabelTemplate } from "@/lib/api/labelTemplates";
import { LabelDataContext, resolveField } from "@/lib/labels/fields";
import { ghsByKey, psaByKey } from "@/lib/labels/symbols";
import { useMergedSymbols } from "@/hooks/useMergedSymbols";

const MM_TO_PX = 3.7795275591; // 96dpi

interface Props {
  template: Pick<LabelTemplate, "width_mm" | "height_mm" | "layout">;
  data: LabelDataContext;
  scale?: number; // multiplier on px (preview vs print)
  className?: string;
  /** When true, render placeholders for empty values (designer/preview). */
  placeholder?: boolean;
}

function Barcode({ value, format, w, h }: { value: string; format: string; w: number; h: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value || " ", {
        format,
        displayValue: false,
        margin: 0,
        width: Math.max(1, w / 60),
        height: Math.max(10, h),
      });
    } catch {
      // invalid value for the format
    }
  }, [value, format, w, h]);
  return <svg ref={ref} style={{ width: "100%", height: "100%" }} />;
}

function QrCode({ value }: { value: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    QRCode.toCanvas(ref.current, value || " ", { margin: 0, scale: 4 }).catch(() => {});
  }, [value]);
  return <canvas ref={ref} style={{ width: "100%", height: "100%" }} />;
}

function ElementView({ el, data, placeholder, ghsLookup, psaLookup }: { el: LabelElement; data: LabelDataContext; placeholder: boolean; ghsLookup: (k: string) => { src: string; label: string } | null; psaLookup: (k: string) => { src: string; label: string } | null }) {
  const common: React.CSSProperties = {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    color: el.color || "#111",
    fontSize: el.fontSize ? `${el.fontSize}pt` : "9pt",
    fontWeight: el.fontWeight || "normal",
    textAlign: el.align || "left",
    lineHeight: 1.15,
    display: "flex",
    flexDirection: "column",
    justifyContent: el.type === "static_text" || el.type === "field" ? "flex-start" : "center",
    alignItems: el.align === "center" ? "center" : el.align === "right" ? "flex-end" : "flex-start",
  };

  if (el.type === "field") {
    const v = el.field ? resolveField(el.field, data) : "";
    const display = v || (placeholder ? `{${el.field}}` : "");
    return <div style={common}><span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{display}</span></div>;
  }
  if (el.type === "static_text") {
    return <div style={common}>{el.text ?? ""}</div>;
  }
  if (el.type === "barcode") {
    const v = el.source ? resolveField(el.source, data) : "";
    return <Barcode value={v} format={el.barcodeFormat || "CODE128"} w={el.w} h={el.h} />;
  }
  if (el.type === "qrcode") {
    const v = el.source ? resolveField(el.source, data) : "";
    return <QrCode value={v} />;
  }
  if (el.type === "logo") {
    const src = data.company?.logo_data_url;
    if (!src) return placeholder ? <div style={{ ...common, border: "1px dashed #888", color: "#888", fontSize: "7pt", alignItems: "center", justifyContent: "center" }}>LOGO</div> : null;
    return <img src={src} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />;
  }
  if (el.type === "ghs") {
    const keys = el.auto ? (data.hazardGhsKeys ?? []) : (el.symbols ?? (el.symbolKey ? [el.symbolKey] : []));
    return (
      <div style={{ display: "flex", gap: 2, flexWrap: "wrap", width: "100%", height: "100%", alignItems: "center", justifyContent: el.align === "center" ? "center" : "flex-start" }}>
        {keys.map((k) => {
          const s = ghsLookup(k);
          return s ? <img key={k} src={s.src} alt={s.label} style={{ height: "100%", maxWidth: "100%", objectFit: "contain" }} /> : null;
        })}
      </div>
    );
  }
  if (el.type === "psa") {
    const keys = el.auto ? (data.psaKeys ?? []) : (el.symbols ?? (el.symbolKey ? [el.symbolKey] : []));
    return (
      <div style={{ display: "flex", gap: 2, flexWrap: "wrap", width: "100%", height: "100%", alignItems: "center", justifyContent: el.align === "center" ? "center" : "flex-start" }}>
        {keys.map((k) => {
          const s = psaLookup(k);
          return s ? <img key={k} src={s.src} alt={s.label} style={{ height: "100%", maxWidth: "100%", objectFit: "contain" }} /> : null;
        })}
      </div>
    );
  }
  if (el.type === "rect") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: el.bg || "transparent",
          border: `${el.borderWidth ?? 1}px solid ${el.border || "#000"}`,
        }}
      />
    );
  }
  if (el.type === "line") {
    return <div style={{ width: "100%", height: "100%", background: el.color || "#000" }} />;
  }
  return null;
}

export function LabelRenderer({ template, data, scale = 1, className, placeholder = false }: Props) {
  const widthPx = template.width_mm * MM_TO_PX * scale;
  const heightPx = template.height_mm * MM_TO_PX * scale;
  const layout: LabelLayout = template.layout ?? { elements: [] };
  const ghsMerged = useMergedSymbols("ghs");
  const psaMerged = useMergedSymbols("psa");
  const norm = (v: string) => v.trim().toLowerCase();
  const ghsLookup = (k: string) => {
    const m = ghsMerged.find((s) => norm(s.key) === norm(k));
    if (m) return { src: m.src, label: m.label };
    const b = ghsByKey(k);
    return b ? { src: b.src, label: b.label } : null;
  };
  const psaLookup = (k: string) => {
    const m = psaMerged.find((s) => norm(s.key) === norm(k));
    if (m) return { src: m.src, label: m.label };
    const b = psaByKey(k);
    return b ? { src: b.src, label: b.label } : null;
  };
  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        background: layout.background || "#fff",
        boxShadow: placeholder ? "0 0 0 1px hsl(var(--border))" : undefined,
        overflow: "hidden",
      }}
    >
      {layout.elements.map((el) => (
        <div
          key={el.id}
          style={{
            position: "absolute",
            left: `${el.x * MM_TO_PX * scale}px`,
            top: `${el.y * MM_TO_PX * scale}px`,
            width: `${el.w * MM_TO_PX * scale}px`,
            height: `${el.h * MM_TO_PX * scale}px`,
          }}
        >
          <ElementView el={el} data={data} placeholder={placeholder} ghsLookup={ghsLookup} psaLookup={psaLookup} />
        </div>
      ))}
    </div>
  );
}

export const LABEL_MM_TO_PX = MM_TO_PX;
