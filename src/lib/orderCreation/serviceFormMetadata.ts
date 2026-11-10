/**
 * ROX – Welche Dienstleistungen besitzen ein echtes Auftraggeberformular?
 *
 * Nur Darstellung: bestimmt die sichtbaren Reiter der Pilot-Plant-Einzel-
 * auftragserstellung. Die Positionsliste (`measurements`) wird nie verändert.
 * Kriterium (eines genügt):
 *  1. Designer-Layout (`service_form_layouts`, role_view = customer) mit
 *     mindestens einem platzierten, nicht ausgeblendeten Feld bzw. aktivem
 *     Repeater mit Feldern – leere Abschnitte zählen nicht.
 *  2. Verknüpftes globales Formular (`service_form_links`) mit aufgelöster
 *     Auftraggeber-Rollenansicht UND vorhandenen Formularfeldern.
 * Interne Messdienstleister-/Ergebnisansichten zählen nie.
 * Dieselben Query-Keys wie die Formular-Renderer → geteilter Cache.
 */
import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface SectionLike {
  repeatable?: { enabled?: boolean } | null;
  fields?: Array<{ field_id?: string; hidden?: boolean }> | null;
}

export function designerLayoutHasCustomerForm(sections: SectionLike[] | null | undefined): boolean {
  return (sections ?? []).some((s) => (s.fields ?? []).some((f) => !!f.field_id && !f.hidden));
}

export function linkedFormIsCustomerForm(viewKey: string | null | undefined, fieldCount: number): boolean {
  return !!viewKey && fieldCount > 0;
}

/** true/false = bekannt, undefined = Metadaten noch nicht geladen. */
export type CustomerFormStatus = Map<string, boolean | undefined>;

export function planServiceTabs<M extends { uid: string; service_id: string }>(
  measurements: M[],
  status: CustomerFormStatus,
): { tabs: M[]; visibleUids: string[]; unresolvedUids: string[] } {
  const tabs = measurements.filter((m) => status.get(m.service_id) === true);
  return {
    tabs,
    visibleUids: tabs.map((m) => m.uid),
    unresolvedUids: measurements.filter((m) => status.get(m.service_id) === undefined).map((m) => m.uid),
  };
}

export function useCustomerFormServices(serviceIds: string[], enabled = true): CustomerFormStatus {
  const ids = Array.from(new Set(serviceIds.filter(Boolean)));
  const layouts = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["service-form-layout", id, "customer"],
      queryFn: () => api.serviceFormLayouts.get(id, "customer"),
      enabled,
    })),
  });
  const links = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["service-form-links", id],
      queryFn: () => api.serviceFormLinks.listForService(id),
      enabled,
    })),
  });
  const formIds = Array.from(new Set(links.flatMap((q) => ((q.data ?? []) as any[]).map((l) => l.form_definition_id as string))));
  const viewKeys = useQueries({
    queries: formIds.map((fid) => ({
      queryKey: ["form-view-key", fid, "customer"],
      queryFn: () => api.formRoleViews.resolveViewKey(fid, "customer"),
      enabled,
    })),
  });
  const fields = useQueries({
    queries: formIds.map((fid) => ({
      queryKey: ["form-fields", fid],
      queryFn: () => api.formFields.listForForm(fid),
      enabled,
    })),
  });

  const out: CustomerFormStatus = new Map();
  ids.forEach((id, i) => {
    const lq = layouts[i];
    const kq = links[i];
    if (lq?.isSuccess && designerLayoutHasCustomerForm((lq.data as any)?.layout?.sections)) { out.set(id, true); return; }
    if (!lq?.isSuccess || !kq?.isSuccess) { out.set(id, undefined); return; }
    let pending = false;
    let found = false;
    for (const l of (kq.data ?? []) as any[]) {
      const j = formIds.indexOf(l.form_definition_id);
      const v = viewKeys[j];
      const f = fields[j];
      if (!v?.isSuccess || !f?.isSuccess) { pending = true; continue; }
      if (linkedFormIsCustomerForm(v.data as string | null, ((f.data ?? []) as any[]).length)) found = true;
    }
    out.set(id, found ? true : pending ? undefined : false);
  });
  return out;
}
