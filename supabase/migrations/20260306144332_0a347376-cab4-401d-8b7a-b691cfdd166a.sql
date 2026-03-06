
ALTER TABLE public.service_parameter_definitions
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS min_value numeric,
  ADD COLUMN IF NOT EXISTS max_value numeric;
