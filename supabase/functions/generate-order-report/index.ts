// Edge function: generate-order-report
// Gathers all order/sample/measurement/results data, renders a PDF via jsPDF
// and stores it in the `order-reports` bucket. Inserts a new version row.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
// @ts-ignore - jsPDF ships as CJS
import { jsPDF } from "npm:jspdf@2.5.1";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller
    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const orderId = body?.order_id as string | undefined;
    const changeReason = (body?.change_reason as string | undefined) ?? null;
    if (!orderId) return json({ error: "order_id required" }, 400);

    // Use service role to gather everything (RLS checked at insert step below)
    const admin = createClient(supabaseUrl, service);

    // 1) Fetch order + project + sample + measurements
    const { data: order, error: orderErr } = await admin
      .from("measurement_orders")
      .select(`
        id, order_number, order_type, status, workflow_status, priority, notes,
        due_date, created_at, created_by, order_kind,
        projects(project_number, project_name),
        samples(sample_number, sample_name, description),
        order_measurements(
          id, measurement_number, status, actual_duration_hours, planned_hours,
          measurement_services(service_name, category, unit_of_measurement),
          measurement_parameters(parameter_name, parameter_value, unit),
          measurement_results(result_name, value, unit, temperature_range_from, temperature_range_to, temperature_unit, remarks, measured_at)
        )
      `)
      .eq("id", orderId)
      .single();

    if (orderErr || !order) return json({ error: "Auftrag nicht gefunden" }, 404);

    // 2) Fetch or create the report header via the user client (RLS enforced)
    let { data: report } = await userClient
      .from("order_reports")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();

    if (!report) {
      const ins = await userClient
        .from("order_reports")
        .insert({ order_id: orderId })
        .select()
        .single();
      if (ins.error) return json({ error: ins.error.message }, 403);
      report = ins.data;
    }

    // 3) Determine next version number
    const { data: latest } = await admin
      .from("order_report_versions")
      .select("version_no")
      .eq("report_id", report.id)
      .order("version_no", { ascending: false })
      .limit(1);
    const nextVersion = (latest?.[0]?.version_no ?? 0) + 1;

    // 4) Fetch company settings (single row)
    const { data: company } = await admin
      .from("company_settings")
      .select("company_name, logo_data_url")
      .maybeSingle();

    // 5) Fetch report layout (role_view='report') — use first service in order as source
    const firstServiceId = order.order_measurements?.[0]?.measurement_services
      ? (order.order_measurements[0] as any).service_id
      : null;
    let layout: any = null;
    if (firstServiceId) {
      const { data: layoutRow } = await admin
        .from("service_form_layouts")
        .select("layout")
        .eq("service_id", firstServiceId)
        .eq("role_view", "report")
        .maybeSingle();
      layout = layoutRow?.layout ?? null;
    }

    // 6) Build data snapshot
    const snapshot = {
      order,
      company: company ?? null,
      generated_at: new Date().toISOString(),
      generated_by: userId,
    };

    // 7) Render PDF (simple, layout-driven if provided, otherwise auto)
    const pdf = renderPdf(snapshot, layout);
    const pdfBuffer = pdf.output("arraybuffer") as ArrayBuffer;

    const storagePath = `${orderId}/v${nextVersion}_${Date.now()}.pdf`;
    const { error: upErr } = await admin.storage
      .from("order-reports")
      .upload(storagePath, new Uint8Array(pdfBuffer), {
        contentType: "application/pdf",
        upsert: false,
      });
    if (upErr) return json({ error: `Upload fehlgeschlagen: ${upErr.message}` }, 500);

    // 8) Insert version row via user client (RLS)
    const versionIns = await userClient
      .from("order_report_versions")
      .insert({
        report_id: report.id,
        version_no: nextVersion,
        layout_snapshot: layout ?? {},
        data_snapshot: snapshot,
        pdf_storage_path: storagePath,
        change_reason: changeReason,
        generated_by: userId,
      })
      .select()
      .single();

    if (versionIns.error) {
      await admin.storage.from("order-reports").remove([storagePath]);
      return json({ error: versionIns.error.message }, 403);
    }

    // 9) Update current_version_no on header
    await admin
      .from("order_reports")
      .update({ current_version_no: nextVersion })
      .eq("id", report.id);

    return json({
      version_id: versionIns.data.id,
      version_no: nextVersion,
      pdf_storage_path: storagePath,
    });
  } catch (err: any) {
    console.error("generate-order-report error", err);
    return json({ error: err?.message ?? "unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function renderPdf(snapshot: any, _layout: any) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let y = 50;

  const order = snapshot.order;
  const project = order?.projects;
  const sample = order?.samples;
  const measurements = order?.order_measurements ?? [];
  const company = snapshot.company;

  // Header
  doc.setFontSize(9).setTextColor(120);
  doc.text(company?.company_name ?? "", marginX, 30);
  doc.text(
    `Erzeugt: ${new Date(snapshot.generated_at).toLocaleString("de-AT")}`,
    pageWidth - marginX,
    30,
    { align: "right" }
  );

  // Title
  doc.setFontSize(18).setTextColor(20);
  doc.text(`Ergebnisbericht`, marginX, y);
  y += 22;
  doc.setFontSize(11).setTextColor(60);
  doc.text(`Auftrag: ${order.order_number ?? order.id}`, marginX, y);
  y += 16;

  // Meta block
  const meta = [
    ["Projekt", project ? `${project.project_number} · ${project.project_name}` : "—"],
    ["Auftragstyp", String(order.order_type ?? "—")],
    ["Status", String(order.status ?? "—")],
    ["Fälligkeit", order.due_date ?? "—"],
    ["Erstellt am", new Date(order.created_at).toLocaleDateString("de-AT")],
    ["Probe", sample ? `${sample.sample_number} · ${sample.sample_name}` : "—"],
  ];
  doc.setFontSize(10).setTextColor(40);
  for (const [k, v] of meta) {
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, marginX, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(v), marginX + 110, y, { maxWidth: pageWidth - marginX - 110 });
    y += 14;
    y = ensureSpace(doc, y);
  }

  if (order.notes) {
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Anmerkungen:", marginX, y);
    doc.setFont("helvetica", "normal");
    y += 12;
    const lines = doc.splitTextToSize(String(order.notes), pageWidth - marginX * 2);
    doc.text(lines, marginX, y);
    y += lines.length * 12;
    y = ensureSpace(doc, y);
  }

  // Measurements
  for (const m of measurements) {
    y += 10;
    y = ensureSpace(doc, y, 60);
    doc.setDrawColor(220);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 14;

    doc.setFontSize(12).setFont("helvetica", "bold").setTextColor(20);
    doc.text(
      `${m.measurement_number ?? ""} · ${m.measurement_services?.service_name ?? "Aufgabe"}`,
      marginX,
      y
    );
    y += 14;
    doc.setFontSize(9).setFont("helvetica", "normal").setTextColor(90);
    doc.text(
      `Kategorie: ${m.measurement_services?.category ?? "—"} · Status: ${m.status ?? "—"} · Ist-Dauer: ${m.actual_duration_hours ?? "—"} h`,
      marginX,
      y
    );
    y += 14;

    // Parameters
    const params = m.measurement_parameters ?? [];
    if (params.length) {
      doc.setFontSize(10).setFont("helvetica", "bold").setTextColor(30);
      doc.text("Prozessparameter", marginX, y);
      y += 12;
      doc.setFont("helvetica", "normal").setFontSize(9);
      for (const p of params) {
        y = ensureSpace(doc, y);
        doc.text(
          `• ${p.parameter_name}: ${p.parameter_value ?? "—"}${p.unit ? " " + p.unit : ""}`,
          marginX + 8,
          y
        );
        y += 12;
      }
    }

    // Results
    const results = m.measurement_results ?? [];
    if (results.length) {
      y += 4;
      y = ensureSpace(doc, y);
      doc.setFontSize(10).setFont("helvetica", "bold").setTextColor(30);
      doc.text("Messergebnisse", marginX, y);
      y += 12;

      // Simple table header
      doc.setFontSize(9).setFont("helvetica", "bold").setTextColor(60);
      const col1 = marginX + 8;
      const col2 = marginX + 260;
      const col3 = marginX + 340;
      const col4 = marginX + 420;
      doc.text("Parameter", col1, y);
      doc.text("Wert", col2, y);
      doc.text("Einheit", col3, y);
      doc.text("Bemerkung", col4, y);
      y += 4;
      doc.setDrawColor(210);
      doc.line(marginX + 4, y, pageWidth - marginX, y);
      y += 10;

      doc.setFont("helvetica", "normal").setTextColor(30);
      for (const r of results) {
        y = ensureSpace(doc, y);
        doc.text(String(r.result_name ?? "—"), col1, y, { maxWidth: col2 - col1 - 8 });
        doc.text(r.value == null ? "—" : String(r.value), col2, y);
        doc.text(String(r.unit ?? ""), col3, y);
        const remLines = doc.splitTextToSize(String(r.remarks ?? ""), pageWidth - col4 - marginX);
        doc.text(remLines, col4, y);
        y += Math.max(12, remLines.length * 12);
      }
    }
  }

  // Footer
  const pages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(140);
    doc.text(
      `Seite ${i} / ${pages}`,
      pageWidth - marginX,
      doc.internal.pageSize.getHeight() - 20,
      { align: "right" }
    );
  }

  return doc;
}

function ensureSpace(doc: any, y: number, need = 30): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + need > pageHeight - 40) {
    doc.addPage();
    return 50;
  }
  return y;
}
