import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface ServiceParameterDefinition {
  id: string;
  service_id: string;
  parameter_name: string;
  unit: string | null;
  default_value: string | null;
  sort_order: number;
  parameter_type: "number" | "text" | "select" | "boolean";
  is_required: boolean;
  parameter_category: "input" | "output";
  select_options: string[];
  conditional_on: string | null;
  conditional_value: string | null;
  description: string | null;
  min_value: number | null;
  max_value: number | null;
}

export function useServiceParameterDefs(serviceId: string | undefined) {
  return useQuery({
    queryKey: ["service-param-defs", serviceId],
    queryFn: async () => {
      const { data, error } = await api
        .from("service_parameter_definitions")
        .select("*")
        .eq("service_id", serviceId!)
        .order("parameter_category")
        .order("sort_order");
      if (error) throw error;
      return (data || []) as unknown as ServiceParameterDefinition[];
    },
    enabled: !!serviceId,
  });
}

export function useAllServiceParameterDefs() {
  return useQuery({
    queryKey: ["all-service-param-defs"],
    queryFn: async () => {
      const { data, error } = await api
        .from("service_parameter_definitions")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data || []) as unknown as ServiceParameterDefinition[];
    },
  });
}

export function useCreateParameterDef() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (def: {
      service_id: string;
      parameter_name: string;
      unit?: string;
      default_value?: string;
      sort_order?: number;
      parameter_type?: string;
      is_required?: boolean;
      parameter_category?: string;
      select_options?: string[];
      conditional_on?: string | null;
      conditional_value?: string;
    }) => {
      const { data, error } = await api
        .from("service_parameter_definitions")
        .insert(def as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-param-defs"] });
      qc.invalidateQueries({ queryKey: ["all-service-param-defs"] });
    },
  });
}

export function useUpdateParameterDef() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      parameter_name?: string;
      unit?: string | null;
      default_value?: string | null;
      sort_order?: number;
      parameter_type?: string;
      is_required?: boolean;
      parameter_category?: string;
      select_options?: string[];
      conditional_on?: string | null;
      conditional_value?: string | null;
    }) => {
      const { error } = await api
        .from("service_parameter_definitions")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-param-defs"] });
      qc.invalidateQueries({ queryKey: ["all-service-param-defs"] });
    },
  });
}

export function useDeleteParameterDef() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api
        .from("service_parameter_definitions")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-param-defs"] });
      qc.invalidateQueries({ queryKey: ["all-service-param-defs"] });
    },
  });
}
