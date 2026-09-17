ALTER TABLE public.raw_material_containers ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.raw_material_batches ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS raw_material_containers_archived_at_idx ON public.raw_material_containers (archived_at);
CREATE INDEX IF NOT EXISTS raw_material_batches_archived_at_idx ON public.raw_material_batches (archived_at);
NOTIFY pgrst, 'reload schema';