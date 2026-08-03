CREATE TABLE public.form_import_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_label TEXT NOT NULL,
  normalized_label TEXT NOT NULL,
  global_field_id UUID REFERENCES public.global_fields(id) ON DELETE CASCADE,
  binding_path TEXT,
  unit TEXT,
  confirm_count INTEGER NOT NULL DEFAULT 1,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (normalized_label, global_field_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_import_mappings TO authenticated;
GRANT ALL ON public.form_import_mappings TO service_role;
ALTER TABLE public.form_import_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Import-Zuordnungen lesbar" ON public.form_import_mappings
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Designer verwalten Import-Zuordnungen" ON public.form_import_mappings
FOR ALL TO authenticated
USING (public.can_manage_designer(auth.uid()))
WITH CHECK (public.can_manage_designer(auth.uid()));

CREATE TABLE public.form_import_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID REFERENCES public.form_definitions(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  field_count INTEGER NOT NULL DEFAULT 0,
  new_global_field_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_import_runs TO authenticated;
GRANT ALL ON public.form_import_runs TO service_role;
ALTER TABLE public.form_import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Import-Laeufe lesbar" ON public.form_import_runs
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Designer verwalten Import-Laeufe" ON public.form_import_runs
FOR ALL TO authenticated
USING (public.can_manage_designer(auth.uid()))
WITH CHECK (public.can_manage_designer(auth.uid()));

CREATE TRIGGER trg_form_import_mappings_updated_at
BEFORE UPDATE ON public.form_import_mappings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_form_import_mappings_norm ON public.form_import_mappings (normalized_label);