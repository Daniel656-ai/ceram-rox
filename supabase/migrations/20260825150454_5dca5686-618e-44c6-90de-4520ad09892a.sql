ALTER TABLE public.measurement_case_instances
  ADD COLUMN IF NOT EXISTS curve_config jsonb NOT NULL DEFAULT '{}'::jsonb;