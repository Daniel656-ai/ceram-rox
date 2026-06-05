ALTER TABLE public.raw_materials
  ADD COLUMN IF NOT EXISTS is_hazardous boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hazard_categories jsonb NOT NULL DEFAULT '[]'::jsonb;