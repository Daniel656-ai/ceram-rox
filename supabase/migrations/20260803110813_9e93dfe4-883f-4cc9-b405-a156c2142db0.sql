ALTER TABLE public.form_fields
  ADD COLUMN IF NOT EXISTS global_field_id uuid REFERENCES public.global_fields(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS binding_path text;

CREATE INDEX IF NOT EXISTS idx_form_fields_global_field ON public.form_fields(global_field_id);