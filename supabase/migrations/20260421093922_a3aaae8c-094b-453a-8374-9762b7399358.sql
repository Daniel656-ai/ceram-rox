-- Allow project owners/leaders to create orders within their projects
DROP POLICY IF EXISTS "Auftraggeber and masters create orders" ON public.measurement_orders;

CREATE POLICY "Authorized users create orders"
ON public.measurement_orders
FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND (
    has_role(auth.uid(), 'master'::app_role)
    OR has_role(auth.uid(), 'auftraggeber'::app_role)
    OR has_project_role(auth.uid(), project_id, 'owner'::project_role)
    OR has_project_role(auth.uid(), project_id, 'leader'::project_role)
  )
);

-- Allow project owners/leaders to add measurements to their orders
DROP POLICY IF EXISTS "Auftraggeber and masters insert measurements" ON public.order_measurements;

CREATE POLICY "Authorized users insert measurements"
ON public.order_measurements
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'master'::app_role)
  OR is_order_creator(auth.uid(), order_id)
  OR EXISTS (
    SELECT 1 FROM measurement_orders mo
    WHERE mo.id = order_measurements.order_id
      AND (
        has_project_role(auth.uid(), mo.project_id, 'owner'::project_role)
        OR has_project_role(auth.uid(), mo.project_id, 'leader'::project_role)
      )
  )
);