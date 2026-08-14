ALTER TABLE public.measurement_results
  ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_label text;

CREATE INDEX IF NOT EXISTS idx_measurement_results_official
  ON public.measurement_results (order_measurement_id) WHERE is_official;