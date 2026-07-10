// Edge function: generate-order-report
// Rendert das im Service Designer konfigurierte Report-Layout server-seitig als PDF.
// Nutzt Bindings (order/project/sample/customer_form/measurement_parameter/result/computed)
// sowie Bearbeiter-Overrides und Handschrift-Bilder aus order_reports.draft_overrides.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
// @ts-ignore - jsPDF ships as CJS
import { jsPDF } from "npm:jspdf@2.5.1";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anon, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const orderId = body?.order_id as string | undefined;
    const changeReason = (body?.change_reason as string | undefined) ?? null;
    if (!orderId) return json({ error: "order_id required" }, 400);

    const admin = createClient(supabaseUrl, service);

    // 1) Auftrag + relationale Daten
    const { data: order, error: orderErr } = await admin
      .from("measurement_orders")
      .select(`
        id, order_number, order_type, status, workflow_status, priority, notes,
        due_date, created_at, created_by, order_kind,
        pp_experiment_number, pp_v2o5_percent, pp_experiment_date,
        pp_previous_experiments, pp_experiment_kind, pp_masse_type, pp_remarks,
        projects:project_id ( id, project_number, project_name, description, start_date, end_date ),
        samples:sample_id ( id, sample_number, sample_name, description, status ),
        order_measurements(
          id, service_id, measurement_number, status, actual_duration_hours, planned_hours,
          measurement_services:service_id ( service_name, category, unit_of_measurement ),
          measurement_parameters ( parameter_name, parameter_value, unit ),
          measurement_results ( result_name, value, unit, temperature_range_from, temperature_range_to, temperature_unit, remarks, measured_at )
        )
      `)
      .eq("id", orderId)
      .single();
    if (orderErr || !order) return json({ error: "Auftrag nicht gefunden" }, 404);

    // 2) Report-Header + Layout
    let { data: report } = await userClient.from("order_reports").select("*").eq("order_id", orderId).maybeSingle();
    if (!report) {
      const ins = await userClient.from("order_reports").insert({ order_id: orderId }).select().single();
      if (ins.error) return json({ error: ins.error.message }, 403);
      report = ins.data;
    }

    const firstServiceId = order.order_measurements?.[0]?.service_id ?? null;
    let layout: any = null;
    let fields: any[] = [];
    if (firstServiceId) {
      const [{ data: layoutRow }, { data: fieldRows }] = await Promise.all([
        admin.from("service_form_layouts").select("layout").eq("service_id", firstServiceId).eq("role_view", "report").maybeSingle(),
        admin.from("service_data_fields").select("*").eq("service_id", firstServiceId),
      ]);
      layout = layoutRow?.layout ?? null;
      fields = fieldRows ?? [];
    }
    const fieldsById = new Map(fields.map((f: any) => [f.id, f]));

    const { data: company } = await admin.from("company_settings").select("company_name, logo_data_url").maybeSingle();

    // 3) Datenkontext
    const parametersByFieldKey: Record<string, string> = {};
    const allResults: any[] = [];
    for (const m of order.order_measurements ?? []) {
      for (const p of (m.measurement_parameters ?? []) as any[]) parametersByFieldKey[p.parameter_name] = p.parameter_value ?? "";
      for (const r of (m.measurement_results ?? []) as any[]) allResults.push(r);
    }
    const ctx = { order, project: order.projects, sample: order.samples, parametersByFieldKey, allResults };
    const overrides = (report as any).draft_overrides ?? {};

    // 4) Nächste Version
    const { data: latest } = await admin
      .from("order_report_versions")
      .select("version_no")
      .eq("report_id", report.id)
      .order("version_no", { ascending: false })
      .limit(1);
    const nextVersion = (latest?.[0]?.version_no ?? 0) + 1;

    // 5) PDF rendern
    const pdf = renderLayoutPdf({ ctx, layout, fieldsById, overrides, company, meta: { generated_at: new Date().toISOString(), generated_by: userId } });
    const pdfBuffer = pdf.output("arraybuffer") as ArrayBuffer;

    const storagePath = `${orderId}/v${nextVersion}_${Date.now()}.pdf`;
    const { error: upErr } = await admin.storage.from("order-reports").upload(storagePath, new Uint8Array(pdfBuffer), {
      contentType: "application/pdf", upsert: false,
    });
    if (upErr) return json({ error: `Upload fehlgeschlagen: ${upErr.message}` }, 500);

    const versionIns = await userClient.from("order_report_versions").insert({
      report_id: report.id,
      version_no: nextVersion,
      layout_snapshot: layout ?? {},
      data_snapshot: { ctx: sanitizeForSnapshot(ctx), overrides },
      pdf_storage_path: storagePath,
      change_reason: changeReason,
      generated_by: userId,
    }).select().single();
    if (versionIns.error) {
      await admin.storage.from("order-reports").remove([storagePath]);
      return json({ error: versionIns.error.message }, 403);
    }
    await admin.from("order_reports").update({ current_version_no: nextVersion }).eq("id", report.id);

    return json({ version_id: versionIns.data.id, version_no: nextVersion, pdf_storage_path: storagePath });
  } catch (err: any) {
    console.error("generate-order-report error", err);
    return json({ error: err?.message ?? "unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function sanitizeForSnapshot(ctx: any) {
  const { order, project, sample, parametersByFieldKey, allResults } = ctx;
  return { order_id: order.id, project_id: project?.id, sample_id: sample?.id, parametersByFieldKey, resultsCount: allResults.length };
}

// ============================ Binding resolver ============================

function resolveBinding(binding: any, ctx: any): { display: string; table?: { columns: string[]; rows: any[][] } } {
  if (!binding) return { display: "" };
  const path = (binding.path ?? "").trim();
  const fmt = (v: any) => (v == null || v === "") ? "" : String(v);
  switch (binding.source) {
    case "order": return { display: fmt(ctx.order?.[path]) };
    case "project": return { display: fmt(ctx.project?.[path]) };
    case "sample": return { display: fmt(ctx.sample?.[path]) };
    case "customer_form": {
      const ppMap: Record<string, any> = {
        V2O5: ctx.order?.pp_v2o5_percent,
        art_des_versuches: ctx.order?.pp_experiment_kind,
        massetyp: ctx.order?.pp_masse_type,
        frühere_versuche: ctx.order?.pp_previous_experiments,
        experiment_number: ctx.order?.pp_experiment_number,
        experiment_date: ctx.order?.pp_experiment_date,
        remarks: ctx.order?.pp_remarks,
      };
      return { display: fmt(ppMap[path] ?? ctx.parametersByFieldKey[path]) };
    }
    case "employee_form":
    case "measurement_parameter":
      return { display: fmt(ctx.parametersByFieldKey[path]) };
    case "measurement_result": {
      if (path === "*" || path === "") {
        return {
          display: `${ctx.allResults.length} Ergebnisse`,
          table: {
            columns: ["Parameter", "Wert", "Einheit", "Bemerkung"],
            rows: ctx.allResults.map((r: any) => [r.result_name, r.value ?? "", r.unit ?? "", r.remarks ?? ""]),
          },
        };
      }
      const hit = ctx.allResults.find((r: any) => r.result_name === path);
      return { display: fmt(hit?.value) };
    }
    case "computed": {
      const nums = ctx.allResults.map((r: any) => Number(r.value)).filter((n: number) => !isNaN(n));
      if (/^sum\(/.test(path)) return { display: fmt(nums.reduce((a: number, b: number) => a + b, 0)) };
      if (/^avg\(/.test(path)) return { display: fmt(nums.length ? nums.reduce((x: number, y: number) => x + y, 0) / nums.length : 0) };
      if (/^count\(/.test(path)) return { display: String(ctx.allResults.length) };
      return { display: "" };
    }
    default: return { display: "" };
  }
}

// ============================ PDF Renderer (layout-driven) ============================

function renderLayoutPdf({ ctx, layout, fieldsById, overrides, company, meta }: any) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;
  let y = 50;

  // Header
  doc.setFontSize(9).setTextColor(120);
  doc.text(company?.company_name ?? "", marginX, 30);
  doc.text(`Erzeugt: ${new Date(meta.generated_at).toLocaleString("de-AT")}`, pageW - marginX, 30, { align: "right" });

  doc.setFontSize(18).setTextColor(20);
  doc.text("Ergebnisbericht", marginX, y);
  y += 22;
  doc.setFontSize(11).setTextColor(60);
  doc.text(`Auftrag: ${ctx.order.order_number ?? ctx.order.id}`, marginX, y);
  y += 20;

  const ensure = (need = 40) => {
    if (y + need > pageH - 40) { doc.addPage(); y = 50; }
  };

  // Fallback: kein Layout → einfache Auto-Zusammenfassung
  if (!layout || !layout.sections?.length) {
    renderAutoSummary(doc, ctx, marginX, pageW, y);
  } else {
    for (const section of layout.sections) {
      ensure(60);
      doc.setDrawColor(220);
      doc.line(marginX, y, pageW - marginX, y);
      y += 14;
      doc.setFontSize(13).setFont("helvetica", "bold").setTextColor(20);
      doc.text(section.title ?? "Abschnitt", marginX, y);
      y += 16;
      if (section.description) {
        doc.setFontSize(9).setFont("helvetica", "normal").setTextColor(100);
        const lines = doc.splitTextToSize(section.description, pageW - marginX * 2);
        doc.text(lines, marginX, y);
        y += lines.length * 11 + 4;
      }

      for (const ref of section.fields ?? []) {
        if (ref.hidden) continue;
        const field = fieldsById.get(ref.field_id);
        if (!field) continue;
        const label = (ref.label_override?.trim?.() || field.display_name) + (field.unit ? ` (${field.unit})` : "");
        const override = overrides[ref.id];

        // Handschrift-Felder inline als Bild einbetten
        if (field.field_type === "handwriting" && override?.image) {
          ensure(140);
          doc.setFontSize(10).setFont("helvetica", "bold").setTextColor(30);
          doc.text(label, marginX, y);
          y += 12;
          try {
            const imgW = pageW - marginX * 2;
            const imgH = 120;
            doc.addImage(override.image, "PNG", marginX, y, imgW, imgH);
            y += imgH + 4;
          } catch (e) {
            doc.setFontSize(8).setTextColor(180, 0, 0);
            doc.text("Handschrift-Bild konnte nicht eingebettet werden", marginX, y);
            y += 12;
          }
          if (override.text) {
            doc.setFontSize(9).setFont("helvetica", "italic").setTextColor(90);
            const tLines = doc.splitTextToSize(`Erkannt: ${override.text}`, pageW - marginX * 2);
            doc.text(tLines, marginX, y);
            y += tLines.length * 11 + 6;
          }
          continue;
        }

        const resolved = ref.binding ? resolveBinding(ref.binding, ctx) : { display: "" };
        const finalDisplay = override !== undefined ? String(override ?? "") : resolved.display;

        // Tabellen-Bindings
        if (resolved.table) {
          ensure(60);
          doc.setFontSize(10).setFont("helvetica", "bold").setTextColor(30);
          doc.text(label, marginX, y);
          y += 12;
          renderTable(doc, resolved.table.columns, resolved.table.rows, marginX, pageW, () => (y), (ny) => (y = ny), ensure);
          y += 8;
          continue;
        }

        ensure(28);
        doc.setFontSize(9).setFont("helvetica", "bold").setTextColor(80);
        doc.text(label + ":", marginX, y);
        doc.setFont("helvetica", "normal").setTextColor(20).setFontSize(10);
        const valueLines = doc.splitTextToSize(finalDisplay || "—", pageW - marginX - 160);
        doc.text(valueLines, marginX + 150, y);
        y += Math.max(14, valueLines.length * 12);
      }
      y += 10;
    }
  }

  // Footer
  const pages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(140);
    doc.text(`Seite ${i} / ${pages}`, pageW - marginX, pageH - 20, { align: "right" });
  }
  return doc;
}

function renderTable(doc: any, columns: string[], rows: any[][], marginX: number, pageW: number, getY: () => number, setY: (n: number) => void, ensure: (n?: number) => void) {
  const colWidth = (pageW - marginX * 2) / columns.length;
  let y = getY();
  doc.setFontSize(9).setFont("helvetica", "bold").setTextColor(60);
  columns.forEach((c, i) => doc.text(c, marginX + i * colWidth + 2, y));
  y += 4;
  doc.setDrawColor(210);
  doc.line(marginX, y, pageW - marginX, y);
  y += 10;
  doc.setFont("helvetica", "normal").setTextColor(30);
  for (const row of rows) {
    setY(y); ensure(16); y = getY();
    row.forEach((cell, i) => {
      const t = doc.splitTextToSize(String(cell ?? ""), colWidth - 4);
      doc.text(t, marginX + i * colWidth + 2, y);
    });
    y += 12;
  }
  setY(y);
}

function renderAutoSummary(doc: any, ctx: any, marginX: number, pageW: number, startY: number) {
  let y = startY;
  const meta: [string, string][] = [
    ["Projekt", ctx.project ? `${ctx.project.project_number} · ${ctx.project.project_name}` : "—"],
    ["Auftragstyp", String(ctx.order.order_type ?? "—")],
    ["Status", String(ctx.order.status ?? "—")],
    ["Probe", ctx.sample ? `${ctx.sample.sample_number} · ${ctx.sample.sample_name}` : "—"],
  ];
  doc.setFontSize(10);
  for (const [k, v] of meta) {
    doc.setFont("helvetica", "bold"); doc.text(`${k}:`, marginX, y);
    doc.setFont("helvetica", "normal"); doc.text(v, marginX + 110, y);
    y += 14;
  }
}
