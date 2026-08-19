CREATE TABLE public.measurement_result_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_type text NOT NULL CHECK (change_type IN ('value','sample_reassignment')),
  order_id uuid,
  order_measurement_id uuid NOT NULL,
  measurement_result_id uuid,
  service_id uuid,
  parameter_name text,
  parameter_label text,
  unit text,
  old_value numeric,
  new_value numeric,
  old_text text,
  new_text text,
  old_sample_id uuid,
  new_sample_id uuid,
  old_sample_number text,
  new_sample_number text,
  affected_result_count integer,
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  changed_by uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mrc_measurement ON public.measurement_result_corrections(order_measurement_id, changed_at DESC);
CREATE INDEX idx_mrc_result ON public.measurement_result_corrections(measurement_result_id, changed_at DESC);

GRANT SELECT ON public.measurement_result_corrections TO authenticated;
GRANT ALL ON public.measurement_result_corrections TO service_role;

ALTER TABLE public.measurement_result_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "History readable with measurement access"
ON public.measurement_result_corrections
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'master'::app_role)
  OR is_assigned_to_measurement(auth.uid(), order_measurement_id)
  OR is_order_creator_via_measurement(auth.uid(), order_measurement_id)
  OR measurement_has_official_result(order_measurement_id)
);

-- Keine INSERT/UPDATE/DELETE Policies: Einträge entstehen ausschliesslich
-- ueber die SECURITY DEFINER Funktionen und sind danach unveraenderbar.

CREATE OR REPLACE FUNCTION public.can_correct_results(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT has_role(_user_id, 'master'::app_role)
      OR has_permission(_user_id, 'results.correct');
$$;

CREATE OR REPLACE FUNCTION public.correct_measurement_result(
  p_result_id uuid,
  p_new_value numeric,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_res public.measurement_results%ROWTYPE;
  v_meas public.order_measurements%ROWTYPE;
  v_hist_id uuid;
BEGIN
  IF NOT public.can_correct_results(auth.uid()) THEN
    RAISE EXCEPTION 'Keine Berechtigung zur Korrektur von Messergebnissen';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Eine Begruendung ist erforderlich';
  END IF;

  SELECT * INTO v_res FROM public.measurement_results WHERE id = p_result_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ergebnis nicht gefunden';
  END IF;
  SELECT * INTO v_meas FROM public.order_measurements WHERE id = v_res.order_measurement_id;

  PERFORM set_config('app.bypass_order_lock', 'on', true);

  UPDATE public.measurement_results
     SET value = p_new_value, updated_at = now()
   WHERE id = p_result_id;

  INSERT INTO public.measurement_result_corrections (
    change_type, order_id, order_measurement_id, measurement_result_id, service_id,
    parameter_name, parameter_label, unit, old_value, new_value,
    old_sample_id, new_sample_id, reason, changed_by
  ) VALUES (
    'value', v_meas.order_id, v_res.order_measurement_id, p_result_id, v_meas.service_id,
    v_res.result_name, COALESCE(v_res.display_label, v_res.result_name), v_res.unit,
    v_res.value, p_new_value, v_meas.sample_id, v_meas.sample_id, btrim(p_reason), auth.uid()
  ) RETURNING id INTO v_hist_id;

  PERFORM set_config('app.bypass_order_lock', 'off', true);
  RETURN v_hist_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reassign_measurement_sample(
  p_measurement_id uuid,
  p_new_sample_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_meas public.order_measurements%ROWTYPE;
  v_old_number text;
  v_new_number text;
  v_count integer;
  v_hist_id uuid;
BEGIN
  IF NOT public.can_correct_results(auth.uid()) THEN
    RAISE EXCEPTION 'Keine Berechtigung zur Korrektur von Messergebnissen';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Eine Begruendung ist erforderlich';
  END IF;

  SELECT * INTO v_meas FROM public.order_measurements WHERE id = p_measurement_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Messdatensatz nicht gefunden';
  END IF;
  IF v_meas.sample_id IS NOT DISTINCT FROM p_new_sample_id THEN
    RAISE EXCEPTION 'Die neue Probe entspricht der bisherigen Probe';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.order_samples os
     WHERE os.order_id = v_meas.order_id AND os.sample_id = p_new_sample_id
  ) THEN
    RAISE EXCEPTION 'Die gewaehlte Probe ist diesem Auftrag nicht zugeordnet';
  END IF;

  SELECT sample_number INTO v_old_number FROM public.samples WHERE id = v_meas.sample_id;
  SELECT sample_number INTO v_new_number FROM public.samples WHERE id = p_new_sample_id;
  SELECT count(*) INTO v_count FROM public.measurement_results WHERE order_measurement_id = p_measurement_id;

  PERFORM set_config('app.bypass_order_lock', 'on', true);

  UPDATE public.order_measurements
     SET sample_id = p_new_sample_id, updated_at = now()
   WHERE id = p_measurement_id;

  INSERT INTO public.measurement_result_corrections (
    change_type, order_id, order_measurement_id, service_id,
    old_sample_id, new_sample_id, old_sample_number, new_sample_number,
    affected_result_count, reason, changed_by
  ) VALUES (
    'sample_reassignment', v_meas.order_id, p_measurement_id, v_meas.service_id,
    v_meas.sample_id, p_new_sample_id, v_old_number, v_new_number,
    v_count, btrim(p_reason), auth.uid()
  ) RETURNING id INTO v_hist_id;

  PERFORM set_config('app.bypass_order_lock', 'off', true);
  RETURN v_hist_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_correct_results(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.correct_measurement_result(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reassign_measurement_sample(uuid, uuid, text) TO authenticated;