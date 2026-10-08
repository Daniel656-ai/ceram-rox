-- Schritt 1: RLS-Härtung „Externer Auftraggeber".
-- Additiv: bestehende (permissive) Policies bleiben unverändert. Zusätzliche
-- RESTRICTIVE SELECT-Policies wirken nur für Benutzer mit der Custom Role
-- „Externer Auftraggeber" (custom_roles.id fa390068-…); für alle anderen ist
-- die Bedingung wahr, interne Berechtigungen bleiben exakt erhalten.

CREATE OR REPLACE FUNCTION public.is_external_customer(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND custom_role_id = 'fa390068-1afe-492d-8a3b-bcbf473c50a0'::uuid
  )
$$;

-- Probe gehört zu einem eigenen Auftrag (Auftragszugehörigkeit maßgeblich).
CREATE OR REPLACE FUNCTION public.external_owns_sample(_user_id uuid, _sample_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.samples s
    WHERE s.id = _sample_id
      AND (
        EXISTS (SELECT 1 FROM public.measurement_orders mo
                WHERE mo.id = s.order_id AND mo.created_by = _user_id)
        OR EXISTS (SELECT 1 FROM public.measurement_orders mo
                   WHERE mo.id = s.pilot_plant_order_id AND mo.created_by = _user_id)
        OR EXISTS (SELECT 1 FROM public.order_samples os
                   JOIN public.measurement_orders mo ON mo.id = os.order_id
                   WHERE os.sample_id = s.id AND mo.created_by = _user_id)
        -- eigene, noch keinem Auftrag zugeordnete Probe
        OR (s.created_by = _user_id
            AND s.order_id IS NULL
            AND s.pilot_plant_order_id IS NULL
            AND NOT EXISTS (SELECT 1 FROM public.order_samples os WHERE os.sample_id = s.id))
      )
  )
$$;

REVOKE ALL ON FUNCTION public.is_external_customer(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.external_owns_sample(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_external_customer(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.external_owns_sample(uuid, uuid) TO authenticated, service_role;

CREATE POLICY "External customer: own orders only"
  ON public.measurement_orders AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.is_external_customer(auth.uid()) OR created_by = auth.uid());

CREATE POLICY "External customer: own samples only"
  ON public.samples AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.is_external_customer(auth.uid()) OR public.external_owns_sample(auth.uid(), id));

CREATE POLICY "External customer: official results of own orders only"
  ON public.measurement_results AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.is_external_customer(auth.uid())
         OR (is_official = true AND public.is_order_creator_via_measurement(auth.uid(), order_measurement_id)));

CREATE POLICY "External customer: documents of own samples only"
  ON public.sample_documents AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.is_external_customer(auth.uid()) OR public.external_owns_sample(auth.uid(), sample_id));

CREATE POLICY "External customer: history of own samples only"
  ON public.sample_history AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.is_external_customer(auth.uid()) OR public.external_owns_sample(auth.uid(), sample_id));