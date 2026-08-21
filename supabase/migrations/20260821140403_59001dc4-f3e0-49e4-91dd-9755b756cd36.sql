ALTER TABLE public.measurement_results
  ADD COLUMN IF NOT EXISTS instance_key text,
  ADD COLUMN IF NOT EXISTS instance_label text,
  ADD COLUMN IF NOT EXISTS instance_context jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_measurement_results_instance
  ON public.measurement_results (order_measurement_id, instance_key);