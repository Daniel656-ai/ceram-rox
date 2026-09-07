CREATE TABLE public.measurement_case_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.measurement_cases(id) ON DELETE CASCADE,
  element_key text NOT NULL,
  label text,
  position integer NOT NULL DEFAULT 0,
  is_official boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, element_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.measurement_case_elements TO authenticated;
GRANT ALL ON public.measurement_case_elements TO service_role;

ALTER TABLE public.measurement_case_elements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "measurement case elements select" ON public.measurement_case_elements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "measurement case elements insert" ON public.measurement_case_elements
  FOR INSERT TO authenticated WITH CHECK (can_manage_designer(auth.uid()));
CREATE POLICY "measurement case elements update" ON public.measurement_case_elements
  FOR UPDATE TO authenticated USING (can_manage_designer(auth.uid())) WITH CHECK (can_manage_designer(auth.uid()));
CREATE POLICY "measurement case elements delete" ON public.measurement_case_elements
  FOR DELETE TO authenticated USING (can_manage_designer(auth.uid()));

CREATE INDEX measurement_case_elements_case_idx ON public.measurement_case_elements (case_id, position);