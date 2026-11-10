import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { dmcSvg } from "@/components/SampleRunSheet";
import { buildOrderRunSheet, orderDmcPayload, type OrderRunSheetService } from "@/lib/runSheet/buildOrderRunSheet";
import { escHtml as esc, specValueHtml, RUN_SHEET_CSS } from "@/lib/runSheet/specHtml";
import { printHtml } from "@/lib/runSheet/printHtml";
import { PPP_LIST_KEYS } from "@/lib/runSheet/pppGroups";
import { isEmptySpecValue, primSpecValue, specLabelOf } from "@/lib/specValues";
import { rawMaterialValueLabel, type RawMaterialLookup } from "@/lib/rawMaterials/displayLabel";
import { ORDER_PRIORITY_LABELS, type OrderPriority } from "@/lib/types";

/** Rohstofftabelle der Knetung: feste fünf Spalten, technische Schlüssel nur lesend zugeordnet. */
const ROHSTOFF_COLS: { key: string; match: RegExp; material?: boolean }[] = [
  { key: "runsheet_rohstoff", match: /^(rohstoff|rohstoff_id|material|material_id)$/i, material: true },
  { key: "runsheet_menge", match: /^(menge|menge_g|amount|quantity)$/i },
  { key: "runsheet_unit", match: /^(einheit|unit)$/i },
  { key: "runsheet_lot", match: /^(lotnummer|lot_number|lot|charge)$/i },
  { key: "runsheet_bemerkung", match: /^(bemerkung|bemerkungen|remark|notiz|note)$/i },
];

const SCHWINDUNG_RE = /^schwindung/i;

/** Auftrags-Laufzettel (A4, kompakt) – nur lesend, Druck über versteckten iframe. */
export function OrderRunSheetButton({ order }: { order: any }) {
  const { t, i18n } = useTranslation("samples");
  const [busy, setBusy] = useState(false);
  const loc = i18n.language?.startsWith("en") ? "en-GB" : "de-AT";
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(loc, { dateStyle: "medium" });

  const handlePrint = async () => {
    if (busy || !order?.id) return;
    setBusy(true);
    try {
      const formId = order?.shared_form_data?.template?.form_definition_id as string | undefined;
      const [fields, events, mats, lists, company] = await Promise.all([
        formId ? api.formFields.listForForm(formId) : Promise.resolve([]),
        api.activityLog.listForOrder(order.id),
        api.rawMaterials.list(),
        api.globalLists.list(),
        api.companySettings.get().catch(() => null),
      ]);
      const listItems = async (key: string) => {
        const l = (lists as any[]).find((x) => String(x.list_key ?? "").toLowerCase() === key);
        return l ? ((await api.globalListItems.list(l.id)) as any[]) : null;
      };
      const [masse, produkt] = await Promise.all([listItems(PPP_LIST_KEYS.masse), listItems(PPP_LIST_KEYS.produkt)]);
      const materials = new Map((mats as any[]).map((m) => [m.id as string, m as RawMaterialLookup]));
      const sheet = buildOrderRunSheet(order, fields as any[], events as any[], { masse, produkt });
      const payload = orderDmcPayload(sheet.number);
      const logo = (company as any)?.logo_data_url as string | null | undefined;
      const dash = (v: string | null) => esc(v ?? "–");

      const formHtml = sheet.form.length === 0
        ? `<p class="muted">${esc(t("runsheet_no_specs"))}</p>`
        : `<table><thead><tr><th>${esc(t("runsheet_field"))}</th><th>${esc(t("runsheet_value"))}</th></tr></thead><tbody>${
            sheet.form.map((f) => `<tr><td>${f.label ? esc(f.label) : `${esc(f.key)}<br><span class="warn">${esc(t("runsheet_missing_def"))}</span>`}</td><td>${specValueHtml(f.raw, f.unit, materials, f.colLabels, { hideIndex: true })}</td></tr>`).join("")
          }</tbody></table>`;

      const g = sheet.grouped;
      /** Dienstleistungsblock: Soll-Vorgaben, Mundstückgruppen mit echtem MS-Wert, keine IST-/Signaturzeilen. */
      const svcBlock = (s: OrderRunSheetService) => {
        const consumed = new Set(s.msGroups.map((x) => x.paramId));
        const plain = s.params.filter((p) => !consumed.has(p.id));
        const msHtml = s.msGroups.map((grp) => `
            <div class="mshead">${esc(grp.label)}</div>
            ${grp.cols.length === 0 ? "" : `<table class="inner"><thead><tr>${grp.cols.map((c) => `<th>${esc(specLabelOf(c))}</th>`).join("")}</tr></thead><tbody>${
              grp.rows.map((r) => `<tr>${grp.cols.map((c) => {
                const v = r[c];
                if (isEmptySpecValue(v)) return "<td>–</td>";
                const d = rawMaterialValueLabel(c, v, materials);
                return `<td>${esc(d ? d.label : primSpecValue(v))}</td>`;
              }).join("")}</tr>`).join("")
            }</tbody></table>`}`).join("");
        const paramsHtml = plain.length === 0 ? ""
          : `<table><thead><tr><th>${esc(t("runsheet_param"))}</th><th>${esc(g ? t("runsheet_target") : t("runsheet_value"))}</th></tr></thead><tbody>${
              plain.map((p) => `<tr><td>${esc(specLabelOf(p.name))}</td><td>${specValueHtml(p.raw, p.unit, materials, undefined, { hideIndex: true })}</td></tr>`).join("")
            }</tbody></table>`;
        return `
          <section class="${g ? "svc" : ""}">
            <h3>${esc(s.serviceName)}${s.measurementNumber ? ` <span class="muted">· ${esc(s.measurementNumber)}</span>` : ""}
              ${s.sampleNumber ? `<span class="muted">· ${esc(t("runsheet_sample"))} ${esc(s.sampleNumber)}</span>` : g ? "" : `<span class="muted">· ${esc(t("runsheet_without_sample"))}</span>`}
              ${g && s.status ? `<span class="status">${esc(t(`runsheet_status_${s.status}`, s.status))}</span>` : ""}</h3>
            ${plain.length === 0 && s.msGroups.length === 0 ? `<p class="muted">${esc(t("runsheet_no_specs"))}</p>` : paramsHtml + msHtml}
          </section>`;
      };

      const by = (grp: string) => sheet.services.filter((s) => s.pppGroup === grp && !SCHWINDUNG_RE.test(s.serviceName.trim()));
      const schwindung = sheet.services.filter((s) => SCHWINDUNG_RE.test(s.serviceName.trim()));
      const knetungSvc = sheet.services.filter((s) => s.pppGroup === "knetung");
      const extrusion = by("extrusion");
      const masseSvc = by("masse");
      const produktSvc = by("produkt");
      const rest = sheet.services.filter((s) =>
        s.pppGroup !== "knetung" && s.pppGroup !== "extrusion" && s.pppGroup !== "masse" && s.pppGroup !== "produkt"
        && !SCHWINDUNG_RE.test(s.serviceName.trim()));

      const rohstoffCell = (row: Record<string, unknown>, col: typeof ROHSTOFF_COLS[number]) => {
        const k = Object.keys(row).find((key) => col.match.test(key));
        const v = k ? row[k] : null;
        if (isEmptySpecValue(v)) return "–";
        const d = col.material ? rawMaterialValueLabel(k!, v, materials) : null;
        return esc(d ? d.label : primSpecValue(v));
      };
      const kn = sheet.knetung;
      const knetungHtml = !g ? "" : `
        <section>
          <h3>${esc(t("runsheet_sub_knetung"))}</h3>
          <p class="kv"><b>${esc(t("runsheet_prep_tasks"))}:</b> ${esc(kn?.vorbereitendeTaetigkeiten ?? "–")}</p>
          <p class="kv"><b>${esc(t("runsheet_knetdauer"))}:</b> ${kn?.knetdauer ? `${esc(kn.knetdauer.value)}${kn.knetdauer.unit ? ` ${esc(kn.knetdauer.unit)}` : ""}` : "–"}</p>
          ${kn && kn.rohstoffe.length > 0 ? `<table><thead><tr>${ROHSTOFF_COLS.map((c) => `<th>${esc(t(c.key))}</th>`).join("")}</tr></thead><tbody>${
            kn.rohstoffe.map((r) => `<tr>${ROHSTOFF_COLS.map((c) => `<td>${rohstoffCell(r, c)}</td>`).join("")}</tr>`).join("")
          }</tbody></table>` : ""}
          ${kn && kn.otherParams.length > 0 ? `<table><thead><tr><th>${esc(t("runsheet_param"))}</th><th>${esc(t("runsheet_target"))}</th></tr></thead><tbody>${
            kn.otherParams.map((p) => `<tr><td>${esc(specLabelOf(p.name))}</td><td>${specValueHtml(p.raw, p.unit, materials, undefined, { hideIndex: true })}</td></tr>`).join("")
          }</tbody></table>` : ""}
          ${knetungSvc.map((s) => s.msGroups.map((grp) => `
            <div class="mshead">${esc(grp.label)}</div>
            ${grp.cols.length === 0 ? "" : `<table class="inner"><thead><tr>${grp.cols.map((c) => `<th>${esc(specLabelOf(c))}</th>`).join("")}</tr></thead><tbody>${
              grp.rows.map((r) => `<tr>${grp.cols.map((c) => `<td>${isEmptySpecValue(r[c]) ? "–" : esc(primSpecValue(r[c]))}</td>`).join("")}</tr>`).join("")
            }</tbody></table>`}`).join("")).join("")}
        </section>`;
      const selectionsHtml = !g ? "" : `
        <section>
          <h3>${esc(t("runsheet_svc_wanted"))}</h3>
          ${sheet.pppSelections.length === 0 ? `<p class="muted">${esc(t("runsheet_no_services"))}</p>` : sheet.pppSelections.map((sel) => `
            <p class="kv"><b>${esc(sel.label)}</b></p>
            ${sel.values.length === 0 ? `<p class="muted">–</p>` : `<ul class="plain">${sel.values.map((v) => `<li>${esc(v)}</li>`).join("")}</ul>`}`).join("")}
        </section>`;

      const svcHtml = !g
        ? (sheet.services.length === 0 ? `<p class="muted">${esc(t("runsheet_no_services"))}</p>` : sheet.services.map(svcBlock).join(""))
        : [
            `<div class="cols2">${knetungHtml}${selectionsHtml}</div>`,
            extrusion.length ? `<h2>${esc(t("runsheet_sub_extrusion"))}</h2>${extrusion.map(svcBlock).join("")}` : "",
            schwindung.length ? `<h2>${esc("Schwindung")}</h2>${schwindung.map(svcBlock).join("")}` : "",
            masseSvc.length ? `<div class="grp">${esc(t("runsheet_grp_mass"))}</div>${masseSvc.map(svcBlock).join("")}` : "",
            produktSvc.length ? `<div class="grp">${esc(t("runsheet_grp_product"))}</div>${produktSvc.map(svcBlock).join("")}` : "",
            rest.map(svcBlock).join(""),
          ].join("");

      const prio = sheet.priority ? (ORDER_PRIORITY_LABELS[sheet.priority as OrderPriority] ?? sheet.priority) : null;
      await printHtml(`<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>${esc(t("runsheet_order_title"))} – ${esc(sheet.number)}</title>
        <style>${RUN_SHEET_CSS}</style></head><body><div class="page">
        <header>
          <div>
            ${logo ? `<img class="logo" src="${logo}" alt="">` : ""}
            <h1>${esc(t("runsheet_order_title"))}</h1>
            <dl>
              <dt>${esc(t("runsheet_order"))}</dt><dd>${dash(sheet.number || null)}${sheet.technicalNumber ? ` <span class="muted">(${esc(t("runsheet_technical"))} ${esc(sheet.technicalNumber)})</span>` : ""}</dd>
              <dt>${esc(t("runsheet_project"))}</dt><dd>${dash(sheet.project)}</dd>
              <dt>${esc(t("runsheet_due"))}</dt><dd>${dash(sheet.dueDate ? fmtDate(sheet.dueDate) : null)}</dd>
              <dt>${esc(t("runsheet_priority"))}</dt><dd>${dash(prio)}</dd>
              <dt>${esc(t("runsheet_created_at"))}</dt><dd>${dash(sheet.createdAt ? fmtDate(sheet.createdAt) : null)}</dd>
            </dl>
          </div>
          <div class="dmc">${payload ? dmcSvg(payload) : `<p class="muted">${esc(t("runsheet_no_dmc"))}</p>`}</div>
        </header>
        ${sheet.notes ? `<h2>${esc(t("runsheet_notes"))}</h2><p>${esc(sheet.notes)}</p>` : ""}
        <h2>${esc(t("runsheet_form_section"))}</h2>
        ${formHtml}
        ${g ? svcHtml : `<h2>${esc(t("runsheet_services_section"))}</h2>${svcHtml}`}
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
