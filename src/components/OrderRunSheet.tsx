import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { dmcSvg } from "@/components/SampleRunSheet";
import { buildOrderRunSheet, orderDmcPayload } from "@/lib/runSheet/buildOrderRunSheet";
import { escHtml as esc, specValueHtml, RUN_SHEET_CSS } from "@/lib/runSheet/specHtml";
import { printHtml } from "@/lib/runSheet/printHtml";
import { specLabelOf } from "@/lib/specValues";
import { ORDER_PRIORITY_LABELS, type OrderPriority } from "@/lib/types";
import type { RawMaterialLookup } from "@/lib/rawMaterials/displayLabel";

/** Auftrags-Laufzettel (A4, mehrseitig) – nur lesend, Druck über eigenes Fenster. */
export function OrderRunSheetButton({ order }: { order: any }) {
  const { t, i18n } = useTranslation("samples");
  const [busy, setBusy] = useState(false);
  const loc = i18n.language?.startsWith("en") ? "en-GB" : "de-AT";
  const fmt = (iso: string) => new Date(iso).toLocaleString(loc, { dateStyle: "medium", timeStyle: "short" });

  const handlePrint = async () => {
    if (busy || !order?.id) return;
    setBusy(true);
    try {
      const formId = order?.shared_form_data?.template?.form_definition_id as string | undefined;
      const [fields, events, mats] = await Promise.all([
        formId ? api.formFields.listForForm(formId) : Promise.resolve([]),
        api.activityLog.listForOrder(order.id),
        api.rawMaterials.list(),
      ]);
      const materials = new Map((mats as any[]).map((m) => [m.id as string, m as RawMaterialLookup]));
      const sheet = buildOrderRunSheet(order, fields as any[], events as any[]);
      const payload = orderDmcPayload(sheet.number);
      const printedAt = fmt(new Date().toISOString());
      const dash = (v: string | null) => esc(v ?? "–");

      const formHtml = sheet.form.length === 0
        ? `<p class="muted">${esc(t("runsheet_no_specs"))}</p>`
        : `<table><thead><tr><th>${esc(t("runsheet_field"))}</th><th>${esc(t("runsheet_value"))}</th></tr></thead><tbody>${
            sheet.form.map((f) => `<tr><td>${f.label ? esc(f.label) : `${esc(f.key)}<br><span class="warn">${esc(t("runsheet_missing_def"))}</span>`}</td><td>${specValueHtml(f.raw, f.unit, materials, f.colLabels)}</td></tr>`).join("")
          }</tbody></table>`;

      const svcHtml = sheet.services.length === 0
        ? `<p class="muted">${esc(t("runsheet_no_services"))}</p>`
        : sheet.services.map((s) => `
          <section>
            <h3>${esc(s.serviceName)}${s.measurementNumber ? ` <span class="muted">· ${esc(s.measurementNumber)}</span>` : ""}
              <span class="muted">· ${s.sampleNumber ? `${esc(t("runsheet_sample"))} ${esc(s.sampleNumber)}` : esc(t("runsheet_without_sample"))}</span></h3>
            ${s.params.length === 0 ? `<p class="muted">${esc(t("runsheet_no_specs"))}</p>`
              : `<table><thead><tr><th>${esc(t("runsheet_param"))}</th><th>${esc(t("runsheet_value"))}</th><th>${esc(t("runsheet_unit"))}</th></tr></thead><tbody>${
                  s.params.map((p) => `<tr><td>${esc(specLabelOf(p.name))}</td><td>${specValueHtml(p.raw, null, materials)}</td><td>${dash(p.unit)}</td></tr>`).join("")
                }</tbody></table>`}
          </section>`).join("");

      const prio = sheet.priority ? (ORDER_PRIORITY_LABELS[sheet.priority as OrderPriority] ?? sheet.priority) : null;
      await printHtml(`<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>${esc(t("runsheet_order_title"))} – ${esc(sheet.number)}</title>
        <style>${RUN_SHEET_CSS}</style></head><body><div class="page">
        <header>
          <div>
            <h1>${esc(t("runsheet_order_title"))}</h1>
            <dl>
              <dt>${esc(t("runsheet_order"))}</dt><dd>${dash(sheet.number || null)}${sheet.technicalNumber ? ` <span class="muted">(${esc(t("runsheet_technical"))} ${esc(sheet.technicalNumber)})</span>` : ""}</dd>
              <dt>${esc(t("runsheet_customer"))}</dt><dd>${dash(sheet.customerName)}</dd>
              <dt>${esc(t("runsheet_project"))}</dt><dd>${dash(sheet.project)}</dd>
              <dt>${esc(t("runsheet_due"))}</dt><dd>${dash(sheet.dueDate ? new Date(sheet.dueDate).toLocaleDateString(loc) : null)}</dd>
              <dt>${esc(t("runsheet_priority"))}</dt><dd>${dash(prio)}</dd>
            </dl>
          </div>
          <div class="dmc">${payload ? dmcSvg(payload) : `<p class="muted">${esc(t("runsheet_no_dmc"))}</p>`}</div>
        </header>
        <div class="stand">
          <span><b>${esc(t("runsheet_printed_at"))}:</b> ${esc(printedAt)}</span>
          <span><b>${esc(t("runsheet_state_services"))}:</b> ${esc(sheet.lastSpecChange ? `${t("runsheet_last_change")} ${fmt(sheet.lastSpecChange)}` : t("runsheet_change_unknown"))}</span>
          <span><b>${esc(t("runsheet_state_form"))}:</b> ${esc(t("runsheet_change_unknown"))}</span>
        </div>
        ${sheet.notes ? `<h2>${esc(t("runsheet_notes"))}</h2><p>${esc(sheet.notes)}</p>` : ""}
        <h2>${esc(t("runsheet_form_section"))}</h2>
        ${formHtml}
        <h2>${esc(t("runsheet_services_section"))}</h2>
        ${svcHtml}
        </div>
        </body></html>`);
    } catch (err: any) {
      toast.error(t("runsheet_error"), { description: err?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handlePrint} disabled={busy}>
      <FileText className="h-4 w-4 mr-1" />{t("runsheet_order_print")}
    </Button>
  );
}
