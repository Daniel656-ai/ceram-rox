import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toSVG } from "bwip-js/browser";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { buildRunSheet, dmcPayload, type RunSheetOrder } from "@/lib/runSheet/buildRunSheet";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function dmcSvg(payload: string): string {
  return toSVG({ bcid: "datamatrix", text: payload, scale: 3, padding: 2 } as any);
}

/** Proben-Laufzettel (A4) – nur lesend, Druck über eigenes Fenster wie beim Etikett. */
export function SampleRunSheetButton({ sample }: { sample: { id: string; sample_number: string; sample_name?: string | null } }) {
  const { t, i18n } = useTranslation("samples");
  const [busy, setBusy] = useState(false);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language?.startsWith("en") ? "en-GB" : "de-AT", {
      dateStyle: "medium", timeStyle: "short",
    });

  const renderOrder = (o: RunSheetOrder, printedAt: string) => {
    const payload = dmcPayload(o.orderNumber, sample.sample_number);
    const services = o.services.map((s) => `
      <section class="svc">
        <h3>${esc(s.serviceName)}${s.measurementNumber ? ` <span class="muted">· ${esc(s.measurementNumber)}</span>` : ""}</h3>
        ${s.params.length === 0
          ? `<p class="muted">${esc(t("runsheet_no_specs"))}</p>`
          : `<table><thead><tr><th>${esc(t("runsheet_param"))}</th><th>${esc(t("runsheet_value"))}</th><th>${esc(t("runsheet_unit"))}</th></tr></thead><tbody>
            ${s.params.map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.value)}</td><td>${esc(p.unit ?? "–")}</td></tr>`).join("")}
            </tbody></table>`}
      </section>`).join("");
    return `
      <div class="page">
        <header>
          <div>
            <h1>${esc(t("runsheet_title"))}</h1>
            <dl>
              <dt>${esc(t("runsheet_order"))}</dt><dd>${esc(o.orderNumber || "–")}</dd>
              <dt>${esc(t("runsheet_sample"))}</dt><dd>${esc(sample.sample_number)}${sample.sample_name ? ` – ${esc(sample.sample_name)}` : ""}</dd>
              <dt>${esc(t("runsheet_customer"))}</dt><dd>${esc(o.customerName ?? "–")}</dd>
            </dl>
          </div>
          <div class="dmc">${payload ? dmcSvg(payload) : `<p class="muted">${esc(t("runsheet_no_dmc"))}</p>`}</div>
        </header>
        <div class="stand">
          <span><b>${esc(t("runsheet_printed_at"))}:</b> ${esc(printedAt)}</span>
          <span><b>${esc(t("runsheet_spec_state"))}:</b> ${esc(o.lastSpecChange ? `${t("runsheet_last_change")} ${fmt(o.lastSpecChange)}` : t("runsheet_change_unknown"))}</span>
        </div>
        <h2>${esc(t("runsheet_specs"))}</h2>
        ${services}
      </div>`;
  };

  const handlePrint = async () => {
    if (busy) return;
    // Fenster synchron öffnen (Popup-Blocker), Inhalt danach schreiben.
    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) { toast.error(t("runsheet_popup_blocked")); return; }
    setBusy(true);
    try {
      const rows = (await api.measurements.listForRunSheet(sample.id)) as any[];
      const changes = await api.activityLog.listSpecChangesForMeasurements(rows.map((r) => r.id));
      const orders = buildRunSheet(sample.id, rows, changes);
      if (orders.length === 0) {
        win.close();
        toast.info(t("runsheet_empty"));
        return;
      }
      const printedAt = fmt(new Date().toISOString());
      win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>${esc(t("runsheet_title"))} – ${esc(sample.sample_number)}</title>
        <style>
          @page { size: A4; margin: 14mm; }
          body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; margin: 0; }
          .page { page-break-after: always; break-after: page; }
          .page:last-child { page-break-after: auto; break-after: auto; }
          header { display: flex; justify-content: space-between; gap: 8mm; border-bottom: 1px solid #999; padding-bottom: 4mm; }
          h1 { font-size: 16pt; margin: 0 0 3mm; }
          h2 { font-size: 12pt; margin: 5mm 0 2mm; }
          h3 { font-size: 11pt; margin: 4mm 0 1.5mm; }
          dl { display: grid; grid-template-columns: auto 1fr; gap: 1mm 4mm; margin: 0; font-size: 11pt; }
          dt { color: #444; } dd { margin: 0; font-weight: bold; }
          .dmc svg { width: 32mm; height: 32mm; }
          .stand { display: flex; justify-content: space-between; gap: 6mm; font-size: 9pt; margin-top: 3mm; }
          .muted { color: #666; font-weight: normal; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #bbb; padding: 1.2mm 2mm; text-align: left; vertical-align: top; }
          th { background: #eee; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .svc { break-inside: avoid; }
        </style></head><body>
        ${orders.map((o) => renderOrder(o, printedAt)).join("")}
        <script>window.onload=function(){setTimeout(function(){window.print();},200);}</script>
        </body></html>`);
      win.document.close();
    } catch (err: any) {
      win.close();
      toast.error(t("runsheet_error"), { description: err?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handlePrint} disabled={busy}>
      <FileText className="h-4 w-4 mr-1" />{t("runsheet_print")}
    </Button>
  );
}
