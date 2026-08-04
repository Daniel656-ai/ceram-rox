ALTER TABLE public.samples
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS v2o5_content numeric,
  ADD COLUMN IF NOT EXISTS operating_hours integer,
  ADD COLUMN IF NOT EXISTS is_used_catalyst boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS raw_material_id uuid REFERENCES public.raw_materials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS raw_material_code text,
  ADD COLUMN IF NOT EXISTS lot_number text,
  ADD COLUMN IF NOT EXISTS bigbag_number text;

CREATE INDEX IF NOT EXISTS idx_samples_category ON public.samples(category);
CREATE INDEX IF NOT EXISTS idx_samples_description_fts ON public.samples USING gin (to_tsvector('simple', coalesce(description,'') || ' ' || coalesce(sample_name,'')));