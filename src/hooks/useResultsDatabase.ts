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
  sampleNumber: string;
  sampleName: string;
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
  workstationName: string;
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
  }>;
  remarks: string;
}

export function useResultsDatabase() {
  const { user, role } = useAuth();

  return useQuery({
    queryKey: ["results-database"],
    queryFn: async () => {
      // Fetch completed measurements with all related data
      const { data: measurements, error } = await api
        .from("order_measurements")
        .select(`
          id, measurement_number, status, assigned_to, actual_duration_hours,
          created_at, updated_at, workstation_id,
          measurement_services(service_name, category, standard_duration_hours),
          measurement_orders(
            id, order_number, order_type, created_by, notes,
            projects(project_number, project_name),
            samples(sample_number, sample_name)
          ),
          measurement_parameters(parameter_name, parameter_value, unit),
          measurement_results(id, result_name, value, unit, temperature_range_from, temperature_range_to, temperature_unit, remarks, measured_at),
          workstations(name)
        `)
        .eq("status", "completed")
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
        const params = m.measurement_parameters || [];

        const inputParameters: Record<string, { value: string | null; unit: string | null }> = {};
        params.forEach((p: any) => {
          inputParameters[p.parameter_name] = { value: p.parameter_value, unit: p.unit };
        });

        return {
          measurementId: m.id,
          measurementNumber: m.measurement_number,
          orderId: order?.id || "",
          orderNumber: order?.order_number || "",
          orderType: order?.order_type || "",
          projectNumber: order?.projects?.project_number || "",
          projectName: order?.projects?.project_name || "",
          sampleNumber: order?.samples?.sample_number || "",
          sampleName: order?.samples?.sample_name || "",
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
          workstationName: m.workstations?.name || "",
          inputParameters,
          outputResults: m.measurement_results || [],
          remarks: order?.notes || "",
        };
      });

      return records;
    },
    enabled: !!user,
  });
}

// Get all unique parameter names across all results
export function getUniqueParameterNames(records: ResultRecord[]) {
  const inputNames = new Set<string>();
  const outputNames = new Set<string>();

  records.forEach(r => {
    Object.keys(r.inputParameters).forEach(k => inputNames.add(k));
    r.outputResults.forEach(o => outputNames.add(o.result_name));
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
  const output = record.outputResults.find(r => r.result_name === paramName);
  if (output?.value != null) return output.value;

  return null;
}
