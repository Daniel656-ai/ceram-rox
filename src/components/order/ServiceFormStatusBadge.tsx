import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { isRuleSatisfied } from "@/lib/ruleEvaluation";
import {
  classicRequiredKeys,
  evaluateServiceFormStatus,
  linkedRequiredKeys,
  SERVICE_FORM_STATUS_LABELS,
  type ServiceFormStatus,
} from "@/lib/orderCreation/serviceFormStatus";

const VARIANT: Record<ServiceFormStatus, "outline" | "secondary" | "destructive" | "default"> = {
  offen: "outline",
  in_bearbeitung: "secondary",
  unvollstaendig: "destructive",
  vollstaendig: "default",
};

/**
 * Bearbeitungsstatus einer Dienstleistungsposition für den Reiter.
 * Wertet ausschließlich die vorhandenen Pflichtfeld- und Sichtbarkeitsregeln
 * des klassischen Auftraggeberformulars und der verknüpften globalen
 * Formulare aus – dieselben Abfragen wie die Formulare selbst (geteilter
 * Abfrage-Cache, keine zusätzliche Datenhaltung).
 */
export default function ServiceFormStatusBadge({
  serviceId,
  values,
}: {
  serviceId: string;
  values: Record<string, any>;
}) {
  const fieldsQuery = useQuery({
    queryKey: ["service-data-fields", serviceId],
    queryFn: () => api.serviceDataFields.listForService(serviceId),
  });
  const layoutQuery = useQuery({
    queryKey: ["service-form-layout", serviceId, "customer"],
    queryFn: () => api.serviceFormLayouts.get(serviceId, "customer"),
  });
  const rulesQuery = useQuery({
    queryKey: ["service-rules", serviceId],
    queryFn: () => api.serviceRules.getForService(serviceId),
  });
  const linksQuery = useQuery({
    queryKey: ["service-form-links", serviceId],
    queryFn: () => api.serviceFormLinks.listForService(serviceId),
    enabled: !!serviceId,
  });

  const links = linksQuery.data ?? [];
  const linkedFieldQueries = useQueries({
    queries: links.map((l: any) => ({
      queryKey: ["form-fields", l.form_definition_id],
      queryFn: () => api.formFields.listForForm(l.form_definition_id),
    })),
  });

  const evaluatedRules = useMemo(() => {
    const hidden = new Set<string>();
    const required = new Set<string>();
    const definition = rulesQuery.data?.definition;
    if (!definition?.rules) return { hidden, required };
    for (const rule of definition.rules) {
      if (!rule.enabled) continue;
      if (!isRuleSatisfied(rule, (k) => values[k])) continue;
      for (const a of rule.actions) {
        if (a.type === "hide_field" && a.target_field_key) hidden.add(a.target_field_key);
        if (a.type === "show_field" && a.target_field_key) hidden.delete(a.target_field_key);
        if (a.type === "require_field" && a.target_field_key) required.add(a.target_field_key);
        if (a.type === "optional_field" && a.target_field_key) required.delete(a.target_field_key);
      }
    }
    return { hidden, required };
  }, [rulesQuery.data, values]);

  const metaReady =
    fieldsQuery.isSuccess && layoutQuery.isSuccess && rulesQuery.isSuccess &&
    linksQuery.isSuccess && linkedFieldQueries.every((q) => q.isSuccess);

  const requiredKeys = useMemo(() => {
    const classic = classicRequiredKeys({
      fields: (fieldsQuery.data ?? []) as any[],
      sections: layoutQuery.data?.layout?.sections ?? null,
      ruleRequired: evaluatedRules.required,
      ruleHidden: evaluatedRules.hidden,
    });
    const linked = links.flatMap((l: any, i: number) =>
      linkedRequiredKeys(l.form_definition_id, (linkedFieldQueries[i]?.data ?? []) as any[])
    );
    return [...classic, ...linked];
  }, [fieldsQuery.data, layoutQuery.data, evaluatedRules, links, linkedFieldQueries]);

  const status = evaluateServiceFormStatus({ values, requiredKeys, metaReady });

  return (
    <Badge variant={VARIANT[status]} className="ml-1.5 text-[10px] font-normal shrink-0">
      {SERVICE_FORM_STATUS_LABELS[status]}
    </Badge>
  );
}
