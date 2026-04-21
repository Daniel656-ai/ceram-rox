DROP POLICY "Relevant users update measurements" ON public.order_measurements;

CREATE POLICY "Relevant users update measurements"
ON public.order_measurements
FOR UPDATE
USING (
  has_role(auth.uid(), 'master'::app_role)
  OR assigned_to = auth.uid()
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