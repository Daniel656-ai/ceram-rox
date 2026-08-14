
ALTER TABLE public.order_samples
  ADD COLUMN IF NOT EXISTS is_replacement boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS replaces_order_sample_id uuid REFERENCES public.order_samples(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replaced_by_order_sample_id uuid REFERENCES public.order_samples(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replacement_reason text,
  ADD COLUMN IF NOT EXISTS replacement_note text,
  ADD COLUMN IF NOT EXISTS replaced_at timestamptz,
  ADD COLUMN IF NOT EXISTS replaced_by uuid;

ALTER TABLE public.order_measurements
  ADD COLUMN IF NOT EXISTS original_sample_id uuid REFERENCES public.samples(id);

CREATE OR REPLACE FUNCTION public.book_replacement_sample(
  p_order_id uuid,
  p_original_sample_id uuid,
  p_replacement_sample_id uuid,
  p_reason text,
  p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_orig public.order_samples%ROWTYPE;
  v_new_id uuid;
  v_allowed boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet';
  END IF;
  IF p_original_sample_id = p_replacement_sample_id THEN
    RAISE EXCEPTION 'Ersatzprobe muss sich von der ursprünglichen Probe unterscheiden';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Grund für Ersatzprobe erforderlich';
  END IF;

  SELECT (
    public.has_role(v_uid, 'master'::app_role)
    OR mo.created_by = v_uid
    OR public.is_assigned_to_order(v_uid, mo.id)
    OR public.has_project_role(v_uid, mo.project_id, 'owner'::project_role)
    OR public.has_project_role(v_uid, mo.project_id, 'leader'::project_role)
  ) INTO v_allowed
  FROM public.measurement_orders mo
  WHERE mo.id = p_order_id;

  IF NOT COALESCE(v_allowed, false) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diesen Auftrag';
  END IF;

  SELECT * INTO v_orig
  FROM public.order_samples
  WHERE order_id = p_order_id AND sample_id = p_original_sample_id
  LIMIT 1;

  IF v_orig.id IS NULL THEN
    RAISE EXCEPTION 'Ursprüngliche Probe ist diesem Auftrag nicht zugeordnet';
  END IF;
  IF v_orig.replaced_by_order_sample_id IS NOT NULL THEN
    RAISE EXCEPTION 'Für diese Probe wurde bereits eine Ersatzprobe gebucht';
  END IF;

  INSERT INTO public.order_samples (
    order_id, sample_id, created_by, is_replacement, replaces_order_sample_id,
    replacement_reason, replacement_note, replaced_at, replaced_by
  ) VALUES (
    p_order_id, p_replacement_sample_id, v_uid, true, v_orig.id,
    p_reason, p_note, now(), v_uid
  )
  RETURNING id INTO v_new_id;

  UPDATE public.order_samples
     SET replaced_by_order_sample_id = v_new_id,
         replacement_reason = p_reason,
         replacement_note = p_note,
         replaced_at = now(),
         replaced_by = v_uid
   WHERE id = v_orig.id;

  UPDATE public.order_measurements
     SET original_sample_id = COALESCE(original_sample_id, p_original_sample_id),
         sample_id = p_replacement_sample_id
   WHERE order_id = p_order_id
     AND sample_id = p_original_sample_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_replacement_sample(uuid, uuid, uuid, text, text) TO authenticated;
