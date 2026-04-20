-- Allow project members to view measurement_orders of their projects
DROP POLICY IF EXISTS "Users see relevant orders" ON public.measurement_orders;
CREATE POLICY "Users see relevant orders"
ON public.measurement_orders
FOR SELECT
USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'master'::app_role)
  OR is_assigned_to_order(auth.uid(), id)
  OR is_project_member(auth.uid(), project_id)
);

-- Allow project members to view order_measurements of their projects
DROP POLICY IF EXISTS "Users see relevant measurements" ON public.order_measurements;
CREATE POLICY "Users see relevant measurements"
ON public.order_measurements
FOR SELECT
USING (
  has_role(auth.uid(), 'master'::app_role)
  OR assigned_to = auth.uid()
  OR is_order_creator(auth.uid(), order_id)
  OR EXISTS (
    SELECT 1 FROM public.measurement_orders mo
    WHERE mo.id = order_measurements.order_id
      AND is_project_member(auth.uid(), mo.project_id)
  )
);

-- Allow project members to view measurement_parameters
DROP POLICY IF EXISTS "Users see relevant params" ON public.measurement_parameters;
CREATE POLICY "Users see relevant params"
ON public.measurement_parameters
FOR SELECT
USING (
  is_assigned_to_measurement(auth.uid(), order_measurement_id)
  OR has_role(auth.uid(), 'master'::app_role)
  OR is_order_creator_via_measurement(auth.uid(), order_measurement_id)
  OR EXISTS (
    SELECT 1
    FROM public.order_measurements om
    JOIN public.measurement_orders mo ON mo.id = om.order_id
    WHERE om.id = measurement_parameters.order_measurement_id
      AND is_project_member(auth.uid(), mo.project_id)
  )
);

-- Allow project members to view measurement_results (read-only)
DROP POLICY IF EXISTS "Users see relevant results" ON public.measurement_results;
CREATE POLICY "Users see relevant results"
ON public.measurement_results
FOR SELECT
USING (
  is_assigned_to_measurement(auth.uid(), order_measurement_id)
  OR has_role(auth.uid(), 'master'::app_role)
  OR is_order_creator_via_measurement(auth.uid(), order_measurement_id)
  OR EXISTS (
    SELECT 1
    FROM public.order_measurements om
    JOIN public.measurement_orders mo ON mo.id = om.order_id
    WHERE om.id = measurement_results.order_measurement_id
      AND is_project_member(auth.uid(), mo.project_id)
  )
);

-- Allow project members to view documents of measurements in their projects
DROP POLICY IF EXISTS "Users see relevant docs" ON public.documents;
CREATE POLICY "Users see relevant docs"
ON public.documents
FOR SELECT
USING (
  uploaded_by = auth.uid()
  OR has_role(auth.uid(), 'master'::app_role)
  OR is_assigned_to_measurement(auth.uid(), order_measurement_id)
  OR is_order_creator_via_measurement(auth.uid(), order_measurement_id)
  OR EXISTS (
    SELECT 1
    FROM public.order_measurements om
    JOIN public.measurement_orders mo ON mo.id = om.order_id
    WHERE om.id = documents.order_measurement_id
      AND is_project_member(auth.uid(), mo.project_id)
  )
);

-- Allow project members to see audit log of their project orders
DROP POLICY IF EXISTS "Users see relevant audit logs" ON public.order_audit_log;
CREATE POLICY "Users see relevant audit logs"
ON public.order_audit_log
FOR SELECT
USING (
  has_role(auth.uid(), 'master'::app_role)
  OR is_order_creator(auth.uid(), order_id)
  OR is_assigned_to_order(auth.uid(), order_id)
  OR EXISTS (
    SELECT 1 FROM public.measurement_orders mo
    WHERE mo.id = order_audit_log.order_id
      AND is_project_member(auth.uid(), mo.project_id)
  )
);