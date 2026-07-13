
-- Link table: multiple services per workflow step
CREATE TABLE IF NOT EXISTS public.service_workflow_step_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id uuid NOT NULL REFERENCES public.service_workflow_steps(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.measurement_services(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (step_id, service_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_workflow_step_services TO authenticated;
GRANT ALL ON public.service_workflow_step_services TO service_role;

ALTER TABLE public.service_workflow_step_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "step-services readable to authenticated"
  ON public.service_workflow_step_services FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "step-services manageable by service admins"
  ON public.service_workflow_step_services FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

CREATE INDEX IF NOT EXISTS idx_sw_step_services_step ON public.service_workflow_step_services(step_id);
CREATE INDEX IF NOT EXISTS idx_sw_step_services_service ON public.service_workflow_step_services(service_id);

-- Auto-complete linked services when a workflow task completes
CREATE OR REPLACE FUNCTION public.autocomplete_linked_services_on_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    UPDATE public.order_measurements om
       SET status = 'completed',
           updated_at = v_now,
           assigned_to = COALESCE(om.assigned_to, NEW.assigned_to),
           actual_duration_hours = COALESCE(om.actual_duration_hours, om.planned_hours)
     WHERE om.order_id = NEW.order_id
       AND om.service_id IN (
         SELECT service_id FROM public.service_workflow_step_services WHERE step_id = NEW.step_id
       )
       AND om.status <> 'completed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autocomplete_linked_services ON public.order_workflow_tasks;
CREATE TRIGGER trg_autocomplete_linked_services
AFTER UPDATE OF status ON public.order_workflow_tasks
FOR EACH ROW EXECUTE FUNCTION public.autocomplete_linked_services_on_task();
