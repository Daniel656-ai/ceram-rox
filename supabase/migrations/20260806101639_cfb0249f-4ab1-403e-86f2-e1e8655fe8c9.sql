ALTER TABLE public.global_calculations
  ADD COLUMN IF NOT EXISTS input_bindings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS output_binding jsonb;