-- Additive read rule: technicians may read the order row of a measurement they are
-- assigned to OR qualified for (competence matrix), mirroring the existing rule on
-- public.order_measurements. No structural change, no new columns, no data change.

CREATE OR REPLACE FUNCTION public.can_read_order_via_measurement(_user_id uuid, _order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_measurements m
    WHERE m.order_id = _order_id
      AND (
        m.assigned_to = _user_id
        OR (
          m.assigned_to IS NULL
          AND m.status <> 'completed'::measurement_status
          AND EXISTS (
            SELECT 1 FROM public.mdl_service_permissions p
            WHERE p.user_id = _user_id AND p.service_id = m.service_id
          )
        )
      )
  )
$$;

CREATE POLICY "Qualified technicians see orders of claimable measurements"
ON public.measurement_orders
FOR SELECT
USING (public.can_read_order_via_measurement(auth.uid(), id));
