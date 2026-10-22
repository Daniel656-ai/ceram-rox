import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toSVG } from "bwip-js/browser";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { buildRunSheet, dmcPayload, type RunSheetOrder } from "@/lib/runSheet/buildRunSheet";
import { specValueHtml, RUN_SHEET_CSS } from "@/lib/runSheet/specHtml";
import { printHtml } from "@/lib/runSheet/printHtml";
import { specLabelOf } from "@/lib/specValues";
import type { RawMaterialLookup } from "@/lib/rawMaterials/displayLabel";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function dmcSvg(payload: string): string {
  return toSVG({ bcid: "datamatrix", text: payload, scale: 3, padding: 2, backgroundcolor: "FFFFFF" } as any);
}

/** Proben-Laufzettel (A4) – nur lesend, Druck über eigenes Fenster wie beim Etikett. */
export function SampleRunSheetButton({ sample }: { sample: { id: string; sample_number: string; sample_name?: string | null } }) {
  const { t, i18n } = useTranslation("samples");
  const [busy, setBusy] = useState(false);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language?.startsWith("en") ? "en-GB" : "de-AT", {
      dateStyle: "medium", timeStyle: "short",
    });

  const renderOrder = (o: RunSheetOrder, printedAt: string, materials: Map<string, RawMaterialLookup>) => {
    const payload = dmcPayload(o.orderNumber, sample.sample_number);
    const services = o.services.map((s) => `
      <section class="svc">
        <h3>${esc(s.serviceName)}${s.measurementNumber ? ` <span class="muted">· ${esc(s.measurementNumber)}</span>` : ""}</h3>
        ${s.params.length === 0
          ? `<p class="muted">${esc(t("runsheet_no_specs"))}</p>`
          : `<table><thead><tr><th>${esc(t("runsheet_param"))}</th><th>${esc(t("runsheet_value"))}</th><th>${esc(t("runsheet_unit"))}</th></tr></thead><tbody>
            ${s.params.map((p) => `<tr><td>${esc(specLabelOf(p.name))}</td><td>${specValueHtml(p.value, null, materials)}</td><td>${esc(p.unit ?? "–")}</td></tr>`).join("")}
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
    setBusy(true);
    try {
      const rows = (await api.measurements.listForRunSheet(sample.id)) as any[];
      const changes = await api.activityLog.listSpecChangesForMeasurements(rows.map((r) => r.id));
      const orders = buildRunSheet(sample.id, rows, changes);
      const mats = (await api.rawMaterials.list()) as any[];
      const materials = new Map(mats.map((m) => [m.id as string, m as RawMaterialLookup]));
      if (orders.length === 0) {
        toast.info(t("runsheet_empty"));
        return;
      }
      const printedAt = fmt(new Date().toISOString());
      await printHtml(`<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>${esc(t("runsheet_title"))} – ${esc(sample.sample_number)}</title>
        <style>${RUN_SHEET_CSS}</style></head><body>
        ${orders.map((o) => renderOrder(o, printedAt, materials)).join("")}
        </body></html>`);
    } catch (err: any) {
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
