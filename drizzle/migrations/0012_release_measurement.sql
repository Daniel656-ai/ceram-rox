CREATE OR REPLACE FUNCTION public.release_measurement(_measurement_id uuid)
RETURNS boolean
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

  SELECT * INTO _row
  FROM public.order_measurements
  WHERE id = _measurement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF _row.status = 'completed' THEN
    RETURN false;
  END IF;

  IF _row.assigned_to IS DISTINCT FROM _uid THEN
    RETURN false;
  END IF;

  UPDATE public.order_measurements
     SET assigned_to = NULL
   WHERE id = _measurement_id
     AND assigned_to = _uid
     AND status <> 'completed';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.release_measurement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_measurement(uuid) TO authenticated;