
-- Step 1: Create SECURITY DEFINER helper functions

CREATE OR REPLACE FUNCTION public.is_order_creator(_user_id uuid, _order_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM measurement_orders WHERE id = _order_id AND created_by = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_assigned_to_order(_user_id uuid, _order_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM order_measurements WHERE order_id = _order_id AND assigned_to = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_assigned_to_measurement(_user_id uuid, _measurement_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM order_measurements WHERE id = _measurement_id AND assigned_to = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_order_creator_via_measurement(_user_id uuid, _measurement_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM order_measurements om
    JOIN measurement_orders mo ON mo.id = om.order_id
    WHERE om.id = _measurement_id AND mo.created_by = _user_id
  )
$$;

-- Step 2: Drop all affected policies

-- projects
DROP POLICY IF EXISTS "Users see own projects" ON projects;

-- measurement_orders
DROP POLICY IF EXISTS "Users see relevant orders" ON measurement_orders;
DROP POLICY IF EXISTS "Users update relevant orders" ON measurement_orders;
DROP POLICY IF EXISTS "Auftraggeber and masters create orders" ON measurement_orders;

-- order_measurements
DROP POLICY IF EXISTS "Users see relevant measurements" ON order_measurements;
DROP POLICY IF EXISTS "Relevant users update measurements" ON order_measurements;
DROP POLICY IF EXISTS "Auftraggeber and masters insert measurements" ON order_measurements;

-- measurement_parameters
DROP POLICY IF EXISTS "Users manage relevant params" ON measurement_parameters;
DROP POLICY IF EXISTS "Users see relevant params" ON measurement_parameters;

-- work_logs
DROP POLICY IF EXISTS "Users see relevant work_logs" ON work_logs;
DROP POLICY IF EXISTS "Durchfuehrer create own logs" ON work_logs;
DROP POLICY IF EXISTS "Users update own logs" ON work_logs;
DROP POLICY IF EXISTS "Users delete own logs" ON work_logs;

-- documents
DROP POLICY IF EXISTS "Users see relevant docs" ON documents;
DROP POLICY IF EXISTS "Relevant users upload docs" ON documents;

-- Step 3: Recreate policies using helper functions

-- projects SELECT
CREATE POLICY "Users see own projects" ON projects FOR SELECT USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'master')
  OR EXISTS (
    SELECT 1 FROM measurement_orders mo
    WHERE mo.project_id = projects.id
    AND is_assigned_to_order(auth.uid(), mo.id)
  )
);

-- measurement_orders SELECT
CREATE POLICY "Users see relevant orders" ON measurement_orders FOR SELECT USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'master')
  OR is_assigned_to_order(auth.uid(), id)
);

-- measurement_orders INSERT
CREATE POLICY "Auftraggeber and masters create orders" ON measurement_orders FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND (has_role(auth.uid(), 'auftraggeber') OR has_role(auth.uid(), 'master'))
);

-- measurement_orders UPDATE
CREATE POLICY "Users update relevant orders" ON measurement_orders FOR UPDATE USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'master')
);

-- order_measurements SELECT
CREATE POLICY "Users see relevant measurements" ON order_measurements FOR SELECT USING (
  has_role(auth.uid(), 'master')
  OR assigned_to = auth.uid()
  OR is_order_creator(auth.uid(), order_id)
);

-- order_measurements INSERT
CREATE POLICY "Auftraggeber and masters insert measurements" ON order_measurements FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'master')
  OR is_order_creator(auth.uid(), order_id)
);

-- order_measurements UPDATE
CREATE POLICY "Relevant users update measurements" ON order_measurements FOR UPDATE USING (
  has_role(auth.uid(), 'master')
  OR assigned_to = auth.uid()
  OR is_order_creator(auth.uid(), order_id)
);

-- measurement_parameters ALL
CREATE POLICY "Users manage relevant params" ON measurement_parameters FOR ALL USING (
  is_assigned_to_measurement(auth.uid(), order_measurement_id)
  OR has_role(auth.uid(), 'master')
  OR is_order_creator_via_measurement(auth.uid(), order_measurement_id)
) WITH CHECK (
  is_assigned_to_measurement(auth.uid(), order_measurement_id)
  OR has_role(auth.uid(), 'master')
  OR is_order_creator_via_measurement(auth.uid(), order_measurement_id)
);

-- measurement_parameters SELECT
CREATE POLICY "Users see relevant params" ON measurement_parameters FOR SELECT USING (
  is_assigned_to_measurement(auth.uid(), order_measurement_id)
  OR has_role(auth.uid(), 'master')
  OR is_order_creator_via_measurement(auth.uid(), order_measurement_id)
);

-- work_logs SELECT
CREATE POLICY "Users see relevant work_logs" ON work_logs FOR SELECT USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'master')
  OR is_order_creator_via_measurement(auth.uid(), order_measurement_id)
);

-- work_logs INSERT
CREATE POLICY "Durchfuehrer create own logs" ON work_logs FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (has_role(auth.uid(), 'durchfuehrer') OR has_role(auth.uid(), 'master'))
);

-- work_logs UPDATE
CREATE POLICY "Users update own logs" ON work_logs FOR UPDATE USING (
  user_id = auth.uid() OR has_role(auth.uid(), 'master')
);

-- work_logs DELETE
CREATE POLICY "Users delete own logs" ON work_logs FOR DELETE USING (
  user_id = auth.uid() OR has_role(auth.uid(), 'master')
);

-- documents SELECT
CREATE POLICY "Users see relevant docs" ON documents FOR SELECT USING (
  uploaded_by = auth.uid()
  OR has_role(auth.uid(), 'master')
  OR is_assigned_to_measurement(auth.uid(), order_measurement_id)
  OR is_order_creator_via_measurement(auth.uid(), order_measurement_id)
);

-- documents INSERT
CREATE POLICY "Relevant users upload docs" ON documents FOR INSERT
WITH CHECK (
  auth.uid() = uploaded_by
  AND (
    has_role(auth.uid(), 'master')
    OR has_role(auth.uid(), 'durchfuehrer')
    OR is_order_creator_via_measurement(auth.uid(), order_measurement_id)
  )
);
