
-- Restrict SECURITY DEFINER helper to authenticated users
REVOKE EXECUTE ON FUNCTION public.can_manage_designer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_designer(uuid) TO authenticated, service_role;

-- Tighten permissive step_runs / positions policies -------------------
DROP POLICY IF EXISTS "step_runs insert" ON public.order_step_runs;
CREATE POLICY "step_runs insert" ON public.order_step_runs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'master'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.order_instances oi
      WHERE oi.id = order_step_runs.order_id
        AND oi.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "step_runs update" ON public.order_step_runs;
CREATE POLICY "step_runs update" ON public.order_step_runs
  FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    OR public.has_role(auth.uid(), 'master'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.order_instances oi
      WHERE oi.id = order_step_runs.order_id AND oi.created_by = auth.uid()
    )
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR public.has_role(auth.uid(), 'master'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.order_instances oi
      WHERE oi.id = order_step_runs.order_id AND oi.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "positions insert" ON public.order_step_positions;
CREATE POLICY "positions insert" ON public.order_step_positions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.order_step_runs r
      LEFT JOIN public.order_instances oi ON oi.id = r.order_id
      WHERE r.id = order_step_positions.step_run_id
        AND (r.assigned_to = auth.uid()
             OR oi.created_by = auth.uid()
             OR public.has_role(auth.uid(), 'master'::app_role))
    )
  );

DROP POLICY IF EXISTS "positions update" ON public.order_step_positions;
CREATE POLICY "positions update" ON public.order_step_positions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.order_step_runs r
      LEFT JOIN public.order_instances oi ON oi.id = r.order_id
      WHERE r.id = order_step_positions.step_run_id
        AND (r.assigned_to = auth.uid()
             OR oi.created_by = auth.uid()
             OR public.has_role(auth.uid(), 'master'::app_role))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.order_step_runs r
      LEFT JOIN public.order_instances oi ON oi.id = r.order_id
      WHERE r.id = order_step_positions.step_run_id
        AND (r.assigned_to = auth.uid()
             OR oi.created_by = auth.uid()
             OR public.has_role(auth.uid(), 'master'::app_role))
    )
  );
