// Edge function: generate-order-report
// Sammelt ALLE mit dem Auftrag verknüpften Datenquellen (Auftrag, Projekt,
// Probe, Auftraggeber-/Messdienstleisterformular, Workflow, Rohstoffe,
// Dienstleistungen, Arbeitszeiten, Anhänge, Systemdaten) und rendert daraus
// per jsPDF einen Bericht. Layout kann Feld-Bindings der Form
// `{ source, path }` enthalten — der Resolver löst diese generisch gegen den
// Snapshot auf, sodass beliebige Platzhalter zusammengeführt werden können.

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

    const admin = createClient(supabaseUrl, service);

    // ================= Datenquellen sammeln =================

    const { data: order, error: orderErr } = await admin
      .from("measurement_orders")
      .select(`
        id, order_number, order_type, status, workflow_status, priority, notes,
        due_date, created_at, created_by, order_kind, shared_form_data,
        pp_experiment_number, pp_v2o5_percent, pp_experiment_date,
        pp_masse_type, pp_remarks, pp_previous_experiments,
        started_at, completed_at,
        projects(project_number, project_name, project_manager, customer, start_date, end_date, status),
        samples!measurement_orders_sample_id_fkey(sample_number, sample_name, description, is_hazardous, material_type),
        order_measurements(
          id, measurement_number, status, actual_duration_hours, planned_hours, assigned_to,
          service_id,
          measurement_services(service_name, category, unit_of_measurement),
          measurement_parameters(parameter_name, parameter_value, unit),
          measurement_results(result_name, value, unit, remarks, measured_at)
        )
      `)
      .eq("id", orderId)
      .single();

    if (orderErr || !order) return json({ error: "Auftrag nicht gefunden" }, 404);

    // Report Header (RLS via user client)
    let { data: report } = await userClient
      .from("order_reports").select("*").eq("order_id", orderId).maybeSingle();
    if (!report) {
      const ins = await userClient.from("order_reports")
        .insert({ order_id: orderId }).select().single();
      if (ins.error) return json({ error: ins.error.message }, 403);
      report = ins.data;
    }

    const { data: latest } = await admin.from("order_report_versions")
      .select("version_no").eq("report_id", report.id)
      .order("version_no", { ascending: false }).limit(1);
    const nextVersion = (latest?.[0]?.version_no ?? 0) + 1;

    const { data: company } = await admin.from("company_settings")
      .select("company_name, logo_data_url").maybeSingle();

    // Layout: erste Dienstleistung des Auftrags
    const firstServiceId = (order.order_measurements?.[0] as any)?.service_id ?? null;
    let layout: any = null;
    if (firstServiceId) {
      const { data: layoutRow } = await admin.from("service_form_layouts")
        .select("layout").eq("service_id", firstServiceId).eq("role_view", "report").maybeSingle();
      layout = layoutRow?.layout ?? null;
    }

    // Zusätzliche Datenquellen parallel laden
    const measurementIds = (order.order_measurements ?? []).map((m: any) => m.id);
    const [
      workflowTasks, workflowSteps,
      uploads, docs,
      workLogs, projectTimeEntries,
      recipe, orderConsumables,
      creator, responsibleProfile,
    ] = await Promise.all([
      admin.from("order_workflow_tasks").select("*").eq("order_id", orderId),
      admin.from("order_step_runs").select("*").eq("order_id", orderId),
      admin.from("order_upload_files").select("*").eq("order_id", orderId),
      measurementIds.length
        ? admin.from("documents").select("*").in("measurement_id", measurementIds)
        : Promise.resolve({ data: [] as any[] }),
      measurementIds.length
        ? admin.from("work_logs").select("*, profiles(full_name, email)").in("measurement_id", measurementIds)
        : Promise.resolve({ data: [] as any[] }),
      admin.from("project_time_entries")
        .select("*, profiles(full_name)").eq("project_id", (order as any).project_id ?? "00000000-0000-0000-0000-000000000000"),
      admin.from("project_knetung_materials").select("*, raw_materials(material_name, code)").eq("order_id", orderId),
      admin.from("order_analysis_requests").select("*").eq("order_id", orderId),
      order.created_by
        ? admin.from("profiles").select("full_name, email").eq("id", order.created_by).maybeSingle()
        : Promise.resolve({ data: null }),
      Promise.resolve({ data: null }),
    ]);

    // ================= Snapshot bauen =================
    const shared = (order as any).shared_form_data ?? {};
    const customerForm = shared?.template?.values ?? shared?.customer ?? shared?.customer_form ?? {};
    const employeeForm = shared?.employee ?? shared?.employee_form ?? {};

    const measurements = order.order_measurements ?? [];
    const allResults = measurements.flatMap((m: any) => (m.measurement_results ?? []).map((r: any) => ({ measurement: m.measurement_number, ...r })));
    const allParams = measurements.flatMap((m: any) => (m.measurement_parameters ?? []).map((p: any) => ({ measurement: m.measurement_number, ...p })));

    const wlRows = (workLogs.data ?? []) as any[];
    const ptRows = (projectTimeEntries.data ?? []) as any[];
    const totalHours = wlRows.reduce((s, w) => s + Number(w.hours_worked ?? 0), 0)
                     + ptRows.reduce((s, w) => s + Number(w.hours ?? 0), 0);

    const uploadRows = (uploads.data ?? []) as any[];
    const docRows = (docs.data ?? []) as any[];
    const isImage = (name: string) => /\.(png|jpe?g|gif|webp|svg|heic)$/i.test(name || "");

    const snapshot: any = {
      order: {
        ...order,
        created_by_name: (creator?.data as any)?.full_name ?? (creator?.data as any)?.email ?? "—",
        responsible_name: (responsibleProfile as any)?.data?.full_name ?? "—",
      },
      project: (order as any).projects ?? null,
      sample: (order as any).samples ?? null,
      customer_form: customerForm,
      employee_form: employeeForm,
      measurement_parameter: allParams,
      measurement_result: allResults,
      workflow: {
        steps: (workflowSteps.data ?? []),
        tasks: (workflowTasks.data ?? []),
        completed_steps: (workflowSteps.data ?? []).filter((s: any) => s.status === "completed").length,
        current_step: (workflowSteps.data ?? []).find((s: any) => s.status === "in_progress")?.step_key ?? null,
        approvals: (workflowSteps.data ?? []).filter((s: any) => s.approved_at).map((s: any) => ({
          step: s.step_key, approver: s.approved_by, at: s.approved_at,
        })),
      },
      raw_material: {
        recipe: (recipe.data ?? []).map((r: any) => ({
          material: r.raw_materials?.material_name,
          code: r.raw_materials?.code,
          quantity: r.quantity, unit: r.unit, lot: r.lot_number,
        })),
        consumed_lots: Array.from(new Set((recipe.data ?? []).map((r: any) => r.lot_number).filter(Boolean))),
      },
      service: {
        names: measurements.map((m: any) => m.measurement_services?.service_name).filter(Boolean),
        categories: Array.from(new Set(measurements.map((m: any) => m.measurement_services?.category).filter(Boolean))),
        list: measurements.map((m: any) => ({
          number: m.measurement_number,
          name: m.measurement_services?.service_name,
          category: m.measurement_services?.category,
          status: m.status,
          hours: m.actual_duration_hours,
        })),
      },
      worklog: {
        entries: [
          ...wlRows.map((w) => ({
            date: w.work_date, user: w.profiles?.full_name ?? w.profiles?.email,
            hours: Number(w.hours_worked ?? 0), notes: w.notes,
          })),
          ...ptRows.map((w) => ({
            date: w.entry_date, user: w.profiles?.full_name,
            hours: Number(w.hours ?? 0), notes: w.notes,
          })),
        ],
        total_hours: totalHours,
        by_user: Object.entries(
          [...wlRows, ...ptRows].reduce((acc: Record<string, number>, w: any) => {
            const u = w.profiles?.full_name ?? w.profiles?.email ?? "—";
            acc[u] = (acc[u] ?? 0) + Number(w.hours_worked ?? w.hours ?? 0);
            return acc;
          }, {})
        ).map(([user, hours]) => ({ user, hours })),
      },
      attachment: {
        all: [...uploadRows, ...docRows].map((a: any) => ({
          name: a.file_name ?? a.name, path: a.storage_path ?? a.file_path,
          uploaded_at: a.created_at,
        })),
        photos: [...uploadRows, ...docRows].filter((a: any) => isImage(a.file_name ?? a.name ?? "")),
        documents: [...uploadRows, ...docRows].filter((a: any) => !isImage(a.file_name ?? a.name ?? "")),
      },
      system: {
        generated_at: new Date().toISOString(),
        generated_by: userId,
        version_no: nextVersion,
        company_name: company?.company_name ?? "",
      },
    };

    // ================= PDF rendern =================
    const pdf = renderPdf(snapshot, layout);
    const pdfBuffer = pdf.output("arraybuffer") as ArrayBuffer;

    const storagePath = `${orderId}/v${nextVersion}_${Date.now()}.pdf`;
    const { error: upErr } = await admin.storage.from("order-reports")
      .upload(storagePath, new Uint8Array(pdfBuffer), { contentType: "application/pdf", upsert: false });
    if (upErr) return json({ error: `Upload fehlgeschlagen: ${upErr.message}` }, 500);

    const versionIns = await userClient.from("order_report_versions").insert({
      report_id: report.id,
      version_no: nextVersion,
      layout_snapshot: layout ?? {},
      data_snapshot: snapshot,
      pdf_storage_path: storagePath,
      change_reason: changeReason,
      generated_by: userId,
    }).select().single();

    if (versionIns.error) {
      await admin.storage.from("order-reports").remove([storagePath]);
      return json({ error: versionIns.error.message }, 403);
    }

    await admin.from("order_reports")
      .update({ current_version_no: nextVersion }).eq("id", report.id);

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
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============= Generischer Binding-Resolver =============

function resolvePath(root: any, path: string): unknown {
  if (!path || path === "*") return root;
  const parts = path.split(".").map((s) => s.trim()).filter(Boolean);
  let cur: any = root;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function resolveBinding(binding: any, snapshot: any): unknown {
  if (!binding) return undefined;
  const { source, path } = binding;
  if (source === "free") return undefined;
  if (source === "computed") return `∑(${path ?? ""})`; // placeholder — evaluated elsewhere
  const bucket = snapshot[source];
  if (bucket === undefined) return undefined;
  return resolvePath(bucket, path ?? "");
}

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (Array.isArray(v)) {
    if (!v.length) return "—";
    // simple list rendering
    return v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ");
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// ============= PDF Renderer =============

function renderPdf(snapshot: any, layout: any) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let y = 50;

  const order = snapshot.order;
  const project = snapshot.project;
  const sample = snapshot.sample;
  const measurements = order?.order_measurements ?? [];
  const company = { company_name: snapshot.system?.company_name ?? "" };

  // Header
  doc.setFontSize(9).setTextColor(120);
  doc.text(company.company_name, marginX, 30);
  doc.text(`Erzeugt: ${new Date(snapshot.system.generated_at).toLocaleString("de-AT")} · v${snapshot.system.version_no}`,
    pageWidth - marginX, 30, { align: "right" });

  // Title
  doc.setFontSize(18).setTextColor(20);
  doc.text("Ergebnisbericht", marginX, y);
  y += 22;
  doc.setFontSize(11).setTextColor(60);
  doc.text(`Auftrag: ${order.order_number ?? order.id}`, marginX, y);
  y += 18;

  // Wenn ein Layout mit Bindings existiert, dieses zuerst rendern
  const sections: any[] = Array.isArray(layout?.sections) ? layout.sections : [];
  if (sections.length) {
    for (const section of sections) {
      y = ensureSpace(doc, y, 60);
      doc.setFontSize(12).setFont("helvetica", "bold").setTextColor(20);
      doc.text(section.title ?? "Abschnitt", marginX, y);
      y += 14;

      const fields = Array.isArray(section.fields) ? section.fields : [];
      doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(40);
      for (const f of fields) {
        const binding = f.binding;
        const label = f.label_override ?? binding?.path ?? "Feld";
        const value = resolveBinding(binding, snapshot);
        y = ensureSpace(doc, y);
        doc.setFont("helvetica", "bold");
        doc.text(`${label}:`, marginX, y);
        doc.setFont("helvetica", "normal");
        const txt = formatValue(value);
        const lines = doc.splitTextToSize(txt, pageWidth - marginX - 130);
        doc.text(lines, marginX + 130, y);
        y += Math.max(14, lines.length * 12);
      }
      y += 8;
    }
    // Standard-Anhang: Datenübersicht
    y = ensureSpace(doc, y, 60);
    doc.setDrawColor(220); doc.line(marginX, y, pageWidth - marginX, y); y += 14;
    doc.setFontSize(11).setFont("helvetica", "bold").setTextColor(40);
    doc.text("Datenübersicht", marginX, y); y += 16;
  }

  // Standard-Metadaten (immer)
  const meta: [string, string][] = [
    ["Projekt", project ? `${project.project_number} · ${project.project_name}` : "—"],
    ["Kunde", project?.customer ?? "—"],
    ["Probe", sample ? `${sample.sample_number} · ${sample.sample_name ?? ""}` : "—"],
    ["Auftragstyp", String(order.order_type ?? "—")],
    ["Status", String(order.status ?? "—")],
    ["Priorität", String(order.priority ?? "—")],
    ["Fälligkeit", order.due_date ?? "—"],
    ["Erstellt am", new Date(order.created_at).toLocaleDateString("de-AT")],
    ["Ersteller", order.created_by_name ?? "—"],
    ["Arbeitszeit gesamt", `${snapshot.worklog.total_hours.toFixed(2)} h`],
  ];
  doc.setFontSize(10).setTextColor(40);
  for (const [k, v] of meta) {
    y = ensureSpace(doc, y);
    doc.setFont("helvetica", "bold"); doc.text(`${k}:`, marginX, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(v), marginX + 110, y, { maxWidth: pageWidth - marginX - 110 });
    y += 14;
  }

  // Auftraggeberformular
  const cf = snapshot.customer_form ?? {};
  const cfEntries = Object.entries(cf);
  if (cfEntries.length) {
    y += 6; y = ensureSpace(doc, y, 40);
    doc.setFontSize(11).setFont("helvetica", "bold").setTextColor(30);
    doc.text("Auftraggeberformular", marginX, y); y += 14;
    doc.setFontSize(10).setFont("helvetica", "normal").setTextColor(40);
    for (const [k, v] of cfEntries) {
      y = ensureSpace(doc, y);
      doc.setFont("helvetica", "bold"); doc.text(`${k}:`, marginX, y);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(formatValue(v), pageWidth - marginX - 160);
      doc.text(lines, marginX + 160, y);
      y += Math.max(14, lines.length * 12);
    }
  }

  // Messungen inkl. Parameter & Ergebnisse
  for (const m of measurements) {
    y += 10; y = ensureSpace(doc, y, 60);
    doc.setDrawColor(220); doc.line(marginX, y, pageWidth - marginX, y); y += 14;
    doc.setFontSize(12).setFont("helvetica", "bold").setTextColor(20);
    doc.text(`${m.measurement_number ?? ""} · ${m.measurement_services?.service_name ?? "Aufgabe"}`, marginX, y);
    y += 14;
    doc.setFontSize(9).setFont("helvetica", "normal").setTextColor(90);
    doc.text(`Kategorie: ${m.measurement_services?.category ?? "—"} · Status: ${m.status ?? "—"} · Ist-Dauer: ${m.actual_duration_hours ?? "—"} h`,
      marginX, y);
    y += 14;

    for (const p of (m.measurement_parameters ?? [])) {
      y = ensureSpace(doc, y);
      doc.setFontSize(9).text(`• ${p.parameter_name}: ${p.parameter_value ?? "—"}${p.unit ? " " + p.unit : ""}`, marginX + 8, y);
      y += 12;
    }
    for (const r of (m.measurement_results ?? [])) {
      y = ensureSpace(doc, y);
      doc.setFontSize(9).text(`◦ ${r.result_name ?? "—"}: ${r.value ?? "—"} ${r.unit ?? ""}${r.remarks ? " (" + r.remarks + ")" : ""}`,
        marginX + 8, y);
      y += 12;
    }
  }

  // Anhänge
  const atts = snapshot.attachment?.all ?? [];
  if (atts.length) {
    y += 10; y = ensureSpace(doc, y, 40);
    doc.setFontSize(11).setFont("helvetica", "bold").setTextColor(30);
    doc.text(`Anhänge (${atts.length})`, marginX, y); y += 14;
    doc.setFontSize(9).setFont("helvetica", "normal").setTextColor(60);
    for (const a of atts) {
      y = ensureSpace(doc, y);
      doc.text(`• ${a.name ?? a.path}`, marginX + 8, y);
      y += 11;
    }
  }

  // Footer
  const pages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(140);
    doc.text(`Seite ${i} / ${pages}`, pageWidth - marginX,
      doc.internal.pageSize.getHeight() - 20, { align: "right" });
  }
  return doc;
}

function ensureSpace(doc: any, y: number, need = 30): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + need > pageHeight - 40) { doc.addPage(); return 50; }
  return y;
}
