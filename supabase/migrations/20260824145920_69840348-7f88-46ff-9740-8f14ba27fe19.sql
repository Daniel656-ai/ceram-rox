CREATE TABLE public.measurement_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  method text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.measurement_cases TO authenticated;
GRANT ALL ON public.measurement_cases TO service_role;
ALTER TABLE public.measurement_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "measurement cases select" ON public.measurement_cases FOR SELECT TO authenticated USING (true);
CREATE POLICY "measurement cases insert" ON public.measurement_cases FOR INSERT TO authenticated WITH CHECK (can_manage_designer(auth.uid()));
CREATE POLICY "measurement cases update" ON public.measurement_cases FOR UPDATE TO authenticated USING (can_manage_designer(auth.uid())) WITH CHECK (can_manage_designer(auth.uid()));
CREATE POLICY "measurement cases delete" ON public.measurement_cases FOR DELETE TO authenticated USING (can_manage_designer(auth.uid()));

CREATE TABLE public.measurement_case_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.measurement_cases(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  method text,
  import_profile_id uuid REFERENCES public.measurement_import_profiles(id) ON DELETE SET NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_measurement_case_instances_case ON public.measurement_case_instances(case_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.measurement_case_instances TO authenticated;
GRANT ALL ON public.measurement_case_instances TO service_role;
ALTER TABLE public.measurement_case_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "measurement case instances select" ON public.measurement_case_instances FOR SELECT TO authenticated USING (true);
CREATE POLICY "measurement case instances insert" ON public.measurement_case_instances FOR INSERT TO authenticated WITH CHECK (can_manage_designer(auth.uid()));
CREATE POLICY "measurement case instances update" ON public.measurement_case_instances FOR UPDATE TO authenticated USING (can_manage_designer(auth.uid())) WITH CHECK (can_manage_designer(auth.uid()));
CREATE POLICY "measurement case instances delete" ON public.measurement_case_instances FOR DELETE TO authenticated USING (can_manage_designer(auth.uid()));

CREATE TRIGGER update_measurement_cases_updated_at BEFORE UPDATE ON public.measurement_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_measurement_case_instances_updated_at BEFORE UPDATE ON public.measurement_case_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();