
-- Allow qualified technicians to see unassigned, open measurements
DROP POLICY IF EXISTS "Users see relevant measurements" ON public.order_measurements;
CREATE POLICY "Users see relevant measurements"
ON public.order_measurements
FOR SELECT
USING (
  has_role(auth.uid(), 'master'::app_role)
  OR assigned_to = auth.uid()
  OR is_order_creator(auth.uid(), order_id)
  OR EXISTS (
    SELECT 1 FROM measurement_orders mo
    WHERE mo.id = order_measurements.order_id
      AND (
        ((NOT has_role(auth.uid(), 'auftraggeber'::app_role)) AND is_project_member(auth.uid(), mo.project_id))
        OR (has_role(auth.uid(), 'auftraggeber'::app_role) AND (has_project_role(auth.uid(), mo.project_id, 'owner'::project_role) OR has_project_role(auth.uid(), mo.project_id, 'leader'::project_role)))
      )
  )
  -- Qualified technicians see unassigned open measurements they may claim
  OR (
    assigned_to IS NULL
    AND status <> 'completed'
    AND EXISTS (
      SELECT 1 FROM public.mdl_service_permissions p
      WHERE p.user_id = auth.uid()
        AND p.service_id = order_measurements.service_id
    )
  )
);

-- Transactional claim: qualified user grabs an unassigned measurement
CREATE OR REPLACE FUNCTION public.claim_measurement(_measurement_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.order_measurements%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Lock row to prevent concurrent claims
  SELECT * INTO _row
  FROM public.order_measurements
  WHERE id = _measurement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'measurement not found';
  END IF;

  IF _row.assigned_to IS NOT NULL THEN
    RAISE EXCEPTION 'measurement already assigned';
  END IF;

  IF _row.status = 'completed' THEN
    RAISE EXCEPTION 'measurement already completed';
  END IF;

  -- Master may claim anything; others must have competence
  IF NOT has_role(_uid, 'master'::app_role) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.mdl_service_permissions
      WHERE user_id = _uid AND service_id = _row.service_id
    ) THEN
      RAISE EXCEPTION 'not qualified for this service';
    END IF;
  END IF;

  UPDATE public.order_measurements
  SET assigned_to = _uid
  WHERE id = _measurement_id;

  RETURN _measurement_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_measurement(uuid) TO authenticated;
