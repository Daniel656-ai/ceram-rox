-- 1. measurement_orders: SELECT
DROP POLICY IF EXISTS "Users see relevant orders" ON public.measurement_orders;
CREATE POLICY "Users see relevant orders"
ON public.measurement_orders
FOR SELECT
USING (
  has_role(auth.uid(), 'master'::app_role)
  OR created_by = auth.uid()
  OR is_assigned_to_order(auth.uid(), id)
  OR (
    NOT has_role(auth.uid(), 'auftraggeber'::app_role)
    AND is_project_member(auth.uid(), project_id)
  )
  OR (
    has_role(auth.uid(), 'auftraggeber'::app_role)
    AND (
      has_project_role(auth.uid(), project_id, 'owner'::project_role)
      OR has_project_role(auth.uid(), project_id, 'leader'::project_role)
    )
  )
);

-- 2. order_measurements: SELECT
DROP POLICY IF EXISTS "Users see relevant measurements" ON public.order_measurements;
CREATE POLICY "Users see relevant measurements"
ON public.order_measurements
FOR SELECT
USING (
  has_role(auth.uid(), 'master'::app_role)
  OR (assigned_to = auth.uid())
  OR is_order_creator(auth.uid(), order_id)
  OR EXISTS (
    SELECT 1 FROM measurement_orders mo
    WHERE mo.id = order_measurements.order_id
      AND (
        (NOT has_role(auth.uid(), 'auftraggeber'::app_role)
          AND is_project_member(auth.uid(), mo.project_id))
        OR (has_role(auth.uid(), 'auftraggeber'::app_role)
          AND (has_project_role(auth.uid(), mo.project_id, 'owner'::project_role)
               OR has_project_role(auth.uid(), mo.project_id, 'leader'::project_role)))
      )
  )
);

-- 3. measurement_parameters: SELECT
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
    FROM order_measurements om
    JOIN measurement_orders mo ON mo.id = om.order_id
    WHERE om.id = measurement_parameters.order_measurement_id
      AND (
        (NOT has_role(auth.uid(), 'auftraggeber'::app_role)
          AND is_project_member(auth.uid(), mo.project_id))
        OR (has_role(auth.uid(), 'auftraggeber'::app_role)
          AND (has_project_role(auth.uid(), mo.project_id, 'owner'::project_role)
               OR has_project_role(auth.uid(), mo.project_id, 'leader'::project_role)))
      )
  )
);

-- 4. measurement_results: SELECT
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
    FROM order_measurements om
    JOIN measurement_orders mo ON mo.id = om.order_id
    WHERE om.id = measurement_results.order_measurement_id
      AND (
        (NOT has_role(auth.uid(), 'auftraggeber'::app_role)
          AND is_project_member(auth.uid(), mo.project_id))
        OR (has_role(auth.uid(), 'auftraggeber'::app_role)
          AND (has_project_role(auth.uid(), mo.project_id, 'owner'::project_role)
               OR has_project_role(auth.uid(), mo.project_id, 'leader'::project_role)))
      )
  )
);

-- 5. documents: SELECT
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
    FROM order_measurements om
    JOIN measurement_orders mo ON mo.id = om.order_id
    WHERE om.id = documents.order_measurement_id
      AND (
        (NOT has_role(auth.uid(), 'auftraggeber'::app_role)
          AND is_project_member(auth.uid(), mo.project_id))
        OR (has_role(auth.uid(), 'auftraggeber'::app_role)
          AND (has_project_role(auth.uid(), mo.project_id, 'owner'::project_role)
               OR has_project_role(auth.uid(), mo.project_id, 'leader'::project_role)))
      )
  )
);

-- 6. order_audit_log: SELECT
DROP POLICY IF EXISTS "Users see relevant audit logs" ON public.order_audit_log;
CREATE POLICY "Users see relevant audit logs"
ON public.order_audit_log
FOR SELECT
USING (
  has_role(auth.uid(), 'master'::app_role)
  OR is_order_creator(auth.uid(), order_id)
  OR is_assigned_to_order(auth.uid(), order_id)
  OR EXISTS (
    SELECT 1 FROM measurement_orders mo
    WHERE mo.id = order_audit_log.order_id
      AND (
        (NOT has_role(auth.uid(), 'auftraggeber'::app_role)
          AND is_project_member(auth.uid(), mo.project_id))
        OR (has_role(auth.uid(), 'auftraggeber'::app_role)
          AND (has_project_role(auth.uid(), mo.project_id, 'owner'::project_role)
               OR has_project_role(auth.uid(), mo.project_id, 'leader'::project_role)))
      )
  )
);
