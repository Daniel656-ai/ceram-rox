import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function useTemplates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["measurement-templates"],
    queryFn: async () => {
      const { data, error } = await api
        .from("measurement_templates")
        .select("*, measurement_template_items(id, service_id, sort_order, measurement_services(id, service_name, category, standard_duration_hours, hourly_rate))")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (template: { name: string; category?: string; description?: string; created_by: string; items: { service_id: string; sort_order: number }[] }) => {
      const { items, ...rest } = template;
      const { data, error } = await api
        .from("measurement_templates")
        .insert(rest as any)
        .select()
        .single();
      if (error) throw error;

      if (items.length > 0) {
        const { error: itemsError } = await api
          .from("measurement_template_items")
          .insert(items.map(i => ({ ...i, template_id: data.id })) as any);
        if (itemsError) throw itemsError;
      }
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["measurement-templates"] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, category, description, items }: { id: string; name: string; category?: string; description?: string; items: { service_id: string; sort_order: number }[] }) => {
      const { error } = await api
        .from("measurement_templates")
        .update({ name, category, description } as any)
        .eq("id", id);
      if (error) throw error;

      // Replace items
      const { error: delErr } = await api
        .from("measurement_template_items")
        .delete()
        .eq("template_id", id);
      if (delErr) throw delErr;

      if (items.length > 0) {
        const { error: insErr } = await api
          .from("measurement_template_items")
          .insert(items.map(i => ({ ...i, template_id: id })) as any);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["measurement-templates"] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.from("measurement_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["measurement-templates"] }),
  });
}

// Apply template to samples - creates orders + measurements
export function useApplyTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      templateId,
      projectId,
      sampleIds,
      createdBy,
      orderType,
      priority,
      dueDate,
    }: {
      templateId: string;
      projectId: string;
      sampleIds: string[];
      createdBy: string;
      orderType: string;
      priority?: string;
      dueDate?: string;
    }) => {
      // Get template items
      const { data: items, error: itemsErr } = await api
        .from("measurement_template_items")
        .select("service_id, sort_order")
        .eq("template_id", templateId)
        .order("sort_order");
      if (itemsErr) throw itemsErr;
      if (!items || items.length === 0) throw new Error("Template has no items");

      const createdOrders: string[] = [];

      for (const sampleId of sampleIds) {
        // Create order per sample
        const { data: order, error: orderErr } = await api
          .from("measurement_orders")
          .insert({
            project_id: projectId,
            sample_id: sampleId,
            order_type: orderType,
            created_by: createdBy,
            priority: priority || "normal",
            due_date: dueDate || null,
            notes: `Template-basiert erstellt`,
          } as any)
          .select()
          .single();
        if (orderErr) throw orderErr;
        createdOrders.push(order.id);

        // Create measurements for each template item
        for (const item of items) {
          const { error: mErr } = await api
            .from("order_measurements")
            .insert({
              order_id: order.id,
              service_id: item.service_id,
              measurement_number: "WILL_BE_OVERWRITTEN",
            } as any);
          if (mErr) throw mErr;
        }
      }

      return createdOrders;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}
