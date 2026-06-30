
CREATE TABLE IF NOT EXISTS public.service_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL UNIQUE REFERENCES public.measurement_services(id) ON DELETE CASCADE,
  definition jsonb NOT NULL DEFAULT '{"states":[],"transitions":[],"initial_state":null}'::jsonb,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_workflows TO authenticated;
GRANT ALL ON public.service_workflows TO service_role;

ALTER TABLE public.service_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflows_read_authenticated" ON public.service_workflows
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "workflows_admin_write" ON public.service_workflows
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'master'::app_role));

CREATE TRIGGER trg_service_workflows_updated_at
  BEFORE UPDATE ON public.service_workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
