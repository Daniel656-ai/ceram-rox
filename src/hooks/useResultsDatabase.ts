import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export interface ResultRecord {
  measurementId: string;
  measurementNumber: string;
  orderId: string;
  orderNumber: string;
  orderType: string;
  projectNumber: string;
  projectName: string;
  sampleId: string | null;
  sampleNumber: string;
  sampleName: string;
  /** Falls die Messung an einer Ersatzprobe durchgeführt wurde. */
  originalSampleNumber: string | null;
  serviceName: string;
  serviceCategory: string;
  assignedToId: string | null;
  assignedToName: string;
  createdById: string;
  createdByName: string;
  status: string;
  completedAt: string | null;
  createdAt: string;
  actualDurationHours: number | null;
  standardDurationHours: number;
  inputParameters: Record<string, { value: string | null; unit: string | null }>;
  outputResults: Array<{
    id: string;
    result_name: string;
    value: number | null;
    unit: string | null;
    temperature_range_from: number | null;
    temperature_range_to: number | null;
    temperature_unit: string | null;
    remarks: string | null;
    measured_at: string | null;
    display_label: string | null;
    is_official: boolean;
  }>;
  remarks: string;
}

export function useResultsDatabase() {
  const { user, role } = useAuth();

  return useQuery({
    queryKey: ["results-database"],
    queryFn: async () => {
      // Die Ergebnisdatenbank zeigt ausschließlich Ergebnisse an, die
      // ausdrücklich als „Offizielles Ergebnis" freigegeben wurden.
      // Der Bearbeitungsstatus einer Tätigkeit (z. B. „erledigt") ist dafür
      // ohne Bedeutung: Erledigte Tätigkeiten ohne offizielles Ergebnis
      // bleiben in ihren Auftrags-/Arbeitsansichten sichtbar, erzeugen hier
      // aber keinen Eintrag. Normale Messwerte (measurement_parameters) sind
      // bewusst nicht Teil dieser Sicht.
      const { data: measurements, error } = await api
        .from("order_measurements")
        .select(`
          id, measurement_number, status, assigned_to, actual_duration_hours,
          created_at, updated_at, sample_id, original_sample_id,
          samples!order_measurements_sample_id_fkey(id, sample_number, sample_name),
          original_sample:samples!order_measurements_original_sample_id_fkey(id, sample_number, sample_name),
          measurement_services(service_name, category, standard_duration_hours),
          measurement_orders(
            id, order_number, order_type, created_by, notes,
            projects(project_number, project_name),
            samples!measurement_orders_sample_id_fkey(id, sample_number, sample_name)
          ),
          measurement_results!inner(id, result_name, value, unit, temperature_range_from, temperature_range_to, temperature_unit, remarks, measured_at, display_label, is_official)
        `)
        .eq("measurement_results.is_official", true)
        .order("updated_at", { ascending: false });

      if (error) throw error;



      // Fetch all profiles for name resolution
      const { data: profiles } = await api
        .from("profiles")
        .select("user_id, first_name, last_name");
      
      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, `${p.first_name} ${p.last_name}`])
      );

      const records: ResultRecord[] = (measurements || []).map((m: any) => {
        const order = m.measurement_orders;
        const service = m.measurement_services;
        const sample = m.samples || order?.samples || null;
        // Eingabe-/Messparameter sind keine Ergebnisse und erscheinen hier nicht.
        const inputParameters: Record<string, { value: string | null; unit: string | null }> = {};


        return {
          measurementId: m.id,
          measurementNumber: m.measurement_number,
          orderId: order?.id || "",
          orderNumber: order?.order_number || "",
          orderType: order?.order_type || "",
          projectNumber: order?.projects?.project_number || "",
          projectName: order?.projects?.project_name || "",
          // Probe kommt ausschließlich aus dem konkreten Messdatensatz
          // (order_measurements.sample_id). Nur wenn die Messung gar keine
          // eigene Probe hat, greift die Auftragsprobe als Altdaten-Fallback.
          sampleId: m.sample_id || order?.samples?.id || null,
          sampleNumber: sample?.sample_number || "",
          sampleName: sample?.sample_name || "",
          originalSampleNumber: m.original_sample?.sample_number || null,
          serviceName: service?.service_name || "",
          serviceCategory: service?.category || "",
          assignedToId: m.assigned_to,
          assignedToName: m.assigned_to ? (profileMap.get(m.assigned_to) || "Unbekannt") : "",
          createdById: order?.created_by || "",
          createdByName: order?.created_by ? (profileMap.get(order.created_by) || "Unbekannt") : "",
          status: m.status,
          completedAt: m.updated_at,
          createdAt: m.created_at,
          actualDurationHours: m.actual_duration_hours,
          standardDurationHours: service?.standard_duration_hours || 0,
          inputParameters,
          // Nur ausdrücklich als „Offizielles Ergebnis" freigegebene Werte
          // gehören in die Ergebnisdatenbank – alle anderen Formularwerte und
          // Messwerte bleiben ausschließlich in den Arbeitsansichten sichtbar.
          outputResults: (m.measurement_results || []).filter((r: any) => r.is_official === true),
          remarks: order?.notes || "",
        };
      });

      // Ohne freigegebenes offizielles Ergebnis entsteht kein Eintrag in der
      // Ergebnisdatenbank – unabhängig vom Bearbeitungsstatus der Tätigkeit.
      return records.filter((r) => r.outputResults.length > 0);


    },
    enabled: !!user,
  });
}

/** Sichtbare, fachliche Bezeichnung eines Ergebnisses – niemals technische IDs. */
export function resultLabel(r: { display_label?: string | null; result_name: string }): string {
  if (r.display_label) return r.display_label;
  // Fallback für Altdaten mit technischem Key (`form:<uuid>:<key>`).
  const raw = r.result_name.startsWith("form:")
    ? r.result_name.slice(r.result_name.indexOf(":", 5) + 1)
    : r.result_name;
  return raw
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

// Get all unique parameter names across all results
export function getUniqueParameterNames(records: ResultRecord[]) {
  const inputNames = new Set<string>();
  const outputNames = new Set<string>();

  records.forEach(r => {
    Object.keys(r.inputParameters).forEach(k => inputNames.add(k));
    r.outputResults.forEach(o => outputNames.add(resultLabel(o)));
  });

  return {
    inputParameterNames: Array.from(inputNames).sort(),
    outputParameterNames: Array.from(outputNames).sort(),
  };
}

// Get numeric value for a result record by parameter name
export function getParameterValue(record: ResultRecord, paramName: string): number | null {
  // Check input parameters
  const input = record.inputParameters[paramName];
  if (input?.value != null) {
    const num = parseFloat(input.value);
    if (!isNaN(num)) return num;
  }

  // Check output results
  const output = record.outputResults.find(r => resultLabel(r) === paramName);
  if (output?.value != null) return output.value;

  return null;
}
