
CREATE OR REPLACE FUNCTION public.measurement_has_official_result(_measurement_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.measurement_results r
    WHERE r.order_measurement_id = _measurement_id AND r.is_official = true
  )
$$;
REVOKE EXECUTE ON FUNCTION public.measurement_has_official_result(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.order_has_official_result(_order_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.order_measurements om
    JOIN public.measurement_results r ON r.order_measurement_id = om.id
    WHERE om.order_id = _order_id AND r.is_official = true
  )
$$;
REVOKE EXECUTE ON FUNCTION public.order_has_official_result(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.project_has_official_result(_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.measurement_orders mo
    JOIN public.order_measurements om ON om.order_id = mo.id
    JOIN public.measurement_results r ON r.order_measurement_id = om.id
    WHERE mo.project_id = _project_id AND r.is_official = true
  )
$$;
REVOKE EXECUTE ON FUNCTION public.project_has_official_result(uuid) FROM anon;

DROP POLICY IF EXISTS "Official results readable by all users" ON public.measurement_results;
CREATE POLICY "Official results readable by all users"
ON public.measurement_results FOR SELECT TO authenticated
USING (is_official = true);

DROP POLICY IF EXISTS "Measurements with official results readable" ON public.order_measurements;
CREATE POLICY "Measurements with official results readable"
ON public.order_measurements FOR SELECT TO authenticated
USING (public.measurement_has_official_result(id));

DROP POLICY IF EXISTS "Orders with official results readable" ON public.measurement_orders;
CREATE POLICY "Orders with official results readable"
ON public.measurement_orders FOR SELECT TO authenticated
USING (public.order_has_official_result(id));

DROP POLICY IF EXISTS "Projects with official results readable" ON public.projects;
CREATE POLICY "Projects with official results readable"
ON public.projects FOR SELECT TO authenticated
USING (public.project_has_official_result(id));
