ALTER TABLE public.raw_materials
  ADD COLUMN IF NOT EXISTS cas_number text,
  ADD COLUMN IF NOT EXISTS mrs_number text;