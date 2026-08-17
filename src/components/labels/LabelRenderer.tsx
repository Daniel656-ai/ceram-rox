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
  /** Rein visueller Zoom. Ändert niemals die gespeicherten mm-Werte. */
  scale?: number;
  className?: string;
  /** When true, render placeholders for empty values (designer/preview). */
  placeholder?: boolean;
}

function mm(v: number) {
  return `${v}mm`;
}

function Barcode({ value, format }: { value: string; format: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value || " ", {
        format,
        displayValue: false,
        margin: 0,
        width: 2,
        height: 100,
      });
      // JsBarcode setzt feste width/height-Attribute – entfernen, damit das
      // Element exakt die im Layout gespeicherte Größe einnimmt.
      ref.current.removeAttribute("width");
      ref.current.removeAttribute("height");
      ref.current.setAttribute("preserveAspectRatio", "none");
      ref.current.style.width = "100%";
      ref.current.style.height = "100%";
    } catch {
      // invalid value for the format
    }
  }, [value, format]);
  return <svg ref={ref} preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }} />;
}

function QrCode({ value }: { value: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    QRCode.toCanvas(el, value || " ", { margin: 0, scale: 8 })
      .then(() => {
        // qrcode.js schreibt feste style.width/height in px auf das Canvas.
        // Diese würden die im Layout gespeicherte Größe überschreiben.
        el.style.width = "100%";
        el.style.height = "100%";
      })
      .catch(() => {});
  }, [value]);
  return <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />;
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
    return <Barcode value={v} format={el.barcodeFormat || "CODE128"} />;
  }
  if (el.type === "qrcode") {
    const v = el.source ? resolveField(el.source, data) : "";
    return <QrCode value={v} />;
  }
  if (el.type === "logo") {
    const src = data.company?.logo_data_url;
    if (!src) return placeholder ? <div style={{ ...common, border: "0.2mm dashed #888", color: "#888", fontSize: "5pt", alignItems: "center", justifyContent: "center" }}>LOGO</div> : null;
    return <img src={src} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />;
  }
  if (el.type === "ghs" || el.type === "psa") {
    const lookup = el.type === "ghs" ? ghsLookup : psaLookup;
    const autoKeys = el.type === "ghs" ? data.hazardGhsKeys : data.psaKeys;
    const keys = el.auto ? (autoKeys ?? []) : (el.symbols ?? (el.symbolKey ? [el.symbolKey] : []));
    return (
      <div style={{ display: "flex", gap: "0.5mm", flexWrap: "wrap", width: "100%", height: "100%", alignItems: "center", justifyContent: el.align === "center" ? "center" : "flex-start" }}>
        {keys.map((k) => {
          const s = lookup(k);
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
          border: `${el.borderWidth ?? 0.3}mm solid ${el.border || "#000"}`,
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

  const label = (
    <div
      style={{
        position: "relative",
        width: mm(template.width_mm),
        height: mm(template.height_mm),
        background: layout.background || "#fff",
        overflow: "hidden",
        transform: scale === 1 ? undefined : `scale(${scale})`,
        transformOrigin: "top left",
      }}
    >
      {layout.elements.map((el) => (
        <div
          key={el.id}
          style={{
            position: "absolute",
            left: mm(el.x),
            top: mm(el.y),
            width: mm(el.w),
            height: mm(el.h),
          }}
        >
          <ElementView el={el} data={data} placeholder={placeholder} ghsLookup={ghsLookup} psaLookup={psaLookup} />
        </div>
      ))}
    </div>
  );

  if (scale === 1) {
    return (
      <div className={className} style={{ boxShadow: placeholder ? "0 0 0 1px hsl(var(--border))" : undefined, width: mm(template.width_mm), height: mm(template.height_mm) }}>
        {label}
      </div>
    );
  }

  // Zoom-Wrapper: rein visuell, verändert keine gespeicherten Werte.
  return (
    <div
      className={className}
      style={{
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        overflow: "hidden",
        boxShadow: placeholder ? "0 0 0 1px hsl(var(--border))" : undefined,
      }}
    >
      {label}
    </div>
  );
}

export const LABEL_MM_TO_PX = MM_TO_PX;
