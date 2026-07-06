
-- Archivierung und sichere Löschung für Dienstleistungen
ALTER TABLE public.measurement_services 
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_measurement_services_archived_at
  ON public.measurement_services (archived_at);

-- Referenzen einer Dienstleistung zählen (blockierende Verwendungen)
CREATE OR REPLACE FUNCTION public.count_service_references(_service_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'order_measurements', (SELECT count(*)::int FROM public.order_measurements WHERE service_id = _service_id),
    'project_services',   (SELECT count(*)::int FROM public.project_services  WHERE service_id = _service_id),
    'template_items',     (SELECT count(*)::int FROM public.measurement_template_items WHERE service_id = _service_id),
    'measurement_results',(
      SELECT count(*)::int FROM public.measurement_results mr
      JOIN public.order_measurements om ON om.id = mr.order_measurement_id
      WHERE om.service_id = _service_id
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.count_service_references(uuid) TO authenticated;

-- Sichere Löschung: prüft Referenzen und lehnt bei Verwendung ab
CREATE OR REPLACE FUNCTION public.delete_service_safe(_service_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_refs jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentifizierung erforderlich';
  END IF;
  IF NOT (has_role(v_uid,'master'::app_role) OR has_permission(v_uid,'services.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Löschen von Dienstleistungen';
  END IF;

  v_refs := public.count_service_references(_service_id);

  IF (v_refs->>'order_measurements')::int > 0
     OR (v_refs->>'project_services')::int > 0
     OR (v_refs->>'template_items')::int > 0
     OR (v_refs->>'measurement_results')::int > 0 THEN
    RAISE EXCEPTION 'Dienstleistung wird verwendet und kann nicht gelöscht werden: %', v_refs::text
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  DELETE FROM public.measurement_services WHERE id = _service_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_service_safe(uuid) TO authenticated;
