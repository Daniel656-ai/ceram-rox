
CREATE TABLE public.service_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL UNIQUE REFERENCES public.measurement_services(id) ON DELETE CASCADE,
  definition jsonb NOT NULL DEFAULT '{"rules":[]}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_rules TO authenticated;
GRANT ALL ON public.service_rules TO service_role;

ALTER TABLE public.service_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_rules read for authenticated"
  ON public.service_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "service_rules write for admins"
  ON public.service_rules FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'master'::app_role)
    OR public.has_permission(auth.uid(), 'admin.system')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'master'::app_role)
    OR public.has_permission(auth.uid(), 'admin.system')
  );

CREATE TRIGGER trg_service_rules_updated_at
  BEFORE UPDATE ON public.service_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
