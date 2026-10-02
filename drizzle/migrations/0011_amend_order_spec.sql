-- 1) Messdienstleister: nur lesender Zugriff auf Auftraggeber-Vorgaben.
--    Schreibrechte nur noch Master oder Auftragsersteller. SELECT-Policy bleibt unverändert.
DROP POLICY IF EXISTS "Users manage relevant params" ON public.measurement_parameters;

CREATE POLICY "Creators and masters insert params" ON public.measurement_parameters
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR is_order_creator_via_measurement(auth.uid(), order_measurement_id));

CREATE POLICY "Creators and masters update params" ON public.measurement_parameters
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'master'::app_role) OR is_order_creator_via_measurement(auth.uid(), order_measurement_id))
WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR is_order_creator_via_measurement(auth.uid(), order_measurement_id));

CREATE POLICY "Creators and masters delete params" ON public.measurement_parameters
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'master'::app_role) OR is_order_creator_via_measurement(auth.uid(), order_measurement_id));

-- 2) Atomare, revisionssichere Änderung einer bestehenden Auftraggeber-Vorgabe.
CREATE OR REPLACE FUNCTION public.amend_order_spec(
  p_parameter_id uuid,
  p_new_value text,
  p_reason text,
  p_label text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_par public.measurement_parameters%ROWTYPE;
  v_meas public.order_measurements%ROWTYPE;
  v_order public.measurement_orders%ROWTYPE;
  v_old jsonb; v_new jsonb;
  v_items jsonb := '[]'::jsonb;
  v_change text;
  v_log_id uuid;
  e jsonb; o jsonb; k text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Nicht angemeldet'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Eine Begruendung ist erforderlich';
  END IF;

  SELECT * INTO v_par FROM public.measurement_parameters WHERE id = p_parameter_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vorgabe nicht gefunden'; END IF;
  SELECT * INTO v_meas FROM public.order_measurements WHERE id = v_par.order_measurement_id FOR UPDATE;
  SELECT * INTO v_order FROM public.measurement_orders WHERE id = v_meas.order_id;

  IF NOT (has_role(v_uid, 'master'::app_role) OR v_order.created_by = v_uid) THEN
    RAISE EXCEPTION 'Keine Berechtigung zur Aenderung von Auftraggeber-Vorgaben';
  END IF;
  IF v_meas.status = 'completed' THEN
    RAISE EXCEPTION 'Die Messaufgabe ist abgeschlossen – Vorgabe kann nicht mehr geaendert werden';
  END IF;
  IF v_par.parameter_value IS NOT DISTINCT FROM p_new_value THEN
    RAISE EXCEPTION 'Der neue Wert entspricht dem bisherigen Wert';
  END IF;

  IF v_par.parameter_name LIKE 'repeat:%' THEN
    BEGIN
      v_old := COALESCE(NULLIF(v_par.parameter_value, '')::jsonb, '[]'::jsonb);
      v_new := COALESCE(NULLIF(p_new_value, '')::jsonb, '[]'::jsonb);
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Ungueltige Liste fuer Wiederholungsbereich';
    END;
    IF jsonb_typeof(v_old) <> 'array' OR jsonb_typeof(v_new) <> 'array' THEN
      RAISE EXCEPTION 'Ungueltige Liste fuer Wiederholungsbereich';
    END IF;
    -- Ergänzt / geändert
    FOR e IN SELECT * FROM jsonb_array_elements(v_new) LOOP
      k := e->>'__id';
      o := NULL;
      IF k IS NOT NULL THEN
        SELECT x INTO o FROM jsonb_array_elements(v_old) x WHERE x->>'__id' = k LIMIT 1;
      END IF;
      IF o IS NULL THEN
        v_items := v_items || jsonb_build_object('change', 'added', 'item_id', k, 'new', e);
      ELSIF o <> e THEN
        v_items := v_items || jsonb_build_object('change', 'modified', 'item_id', k, 'old', o, 'new', e);
      END IF;
    END LOOP;
    -- Entfernt
    FOR o IN SELECT * FROM jsonb_array_elements(v_old) LOOP
      k := o->>'__id';
      IF k IS NULL OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_new) x WHERE x->>'__id' = k) THEN
        v_items := v_items || jsonb_build_object('change', 'removed', 'item_id', k, 'old', o);
      END IF;
    END LOOP;
    v_change := CASE
      WHEN jsonb_array_length(v_items) > 0 AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_items) i WHERE i->>'change' <> 'added') THEN 'item_added'
      WHEN jsonb_array_length(v_items) > 0 AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_items) i WHERE i->>'change' <> 'removed') THEN 'item_removed'
      ELSE 'modified' END;
  ELSE
    v_change := 'modified';
  END IF;

  UPDATE public.measurement_parameters SET parameter_value = p_new_value WHERE id = p_parameter_id;

  INSERT INTO public.activity_log (event_type, actor_user_id, order_id, order_measurement_id, project_id, service_id, metadata)
  VALUES (
    'order_spec_updated', v_uid, v_meas.order_id, v_meas.id, v_order.project_id, v_meas.service_id,
    jsonb_build_object(
      'parameter_id', v_par.id,
      'parameter_name', v_par.parameter_name,
      'parameter_label', COALESCE(NULLIF(btrim(p_label), ''), v_par.parameter_name),
      'unit', v_par.unit,
      'change_type', v_change,
      'old_value', v_par.parameter_value,
      'new_value', p_new_value,
      'items', v_items,
      'sample_id', v_meas.sample_id,
      'reason', btrim(p_reason)
    )
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.amend_order_spec(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.amend_order_spec(uuid, text, text, text) TO authenticated;