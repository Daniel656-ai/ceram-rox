ALTER TABLE public.measurement_services ADD COLUMN IF NOT EXISTS sampling_code text;

CREATE UNIQUE INDEX IF NOT EXISTS measurement_services_sampling_code_active_idx
  ON public.measurement_services (lower(sampling_code))
  WHERE sampling_code IS NOT NULL AND active AND archived_at IS NULL;

NOTIFY pgrst, 'reload schema';