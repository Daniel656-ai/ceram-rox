ALTER TABLE public.form_fields
  ADD COLUMN IF NOT EXISTS is_result boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS result_label text;

ALTER TABLE public.form_calculations
  ADD COLUMN IF NOT EXISTS is_result boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS result_label text;

ALTER TABLE public.global_calculations
  ADD COLUMN IF NOT EXISTS is_result boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS result_label text;

ALTER TABLE public.service_data_fields
  ADD COLUMN IF NOT EXISTS is_result boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS result_label text;

ALTER TABLE public.global_fields
  ADD COLUMN IF NOT EXISTS is_result boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS result_label text;