
CREATE TABLE IF NOT EXISTS public.service_form_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.measurement_services(id) ON DELETE CASCADE,
  role_view text NOT NULL CHECK (role_view IN ('customer','employee','public')),
  layout jsonb NOT NULL DEFAULT '{"sections":[]}'::jsonb,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(service_id, role_view)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_form_layouts TO authenticated;
GRANT ALL ON public.service_form_layouts TO service_role;

ALTER TABLE public.service_form_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "form_layouts_read_authenticated" ON public.service_form_layouts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "form_layouts_admin_write" ON public.service_form_layouts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'master'::app_role));

CREATE TRIGGER trg_service_form_layouts_updated_at
  BEFORE UPDATE ON public.service_form_layouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
