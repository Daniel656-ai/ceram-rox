
ALTER TABLE public.storage_locations
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.storage_locations
SET name = COALESCE(NULLIF(trim(concat_ws(' › ', hall, room, shelf, position)), ''), 'Lagerort ' || substr(id::text, 1, 8))
WHERE name IS NULL OR name = '';

ALTER TABLE public.storage_locations ALTER COLUMN name SET NOT NULL;
ALTER TABLE public.storage_locations ALTER COLUMN hall DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS storage_locations_name_unique_ci ON public.storage_locations (lower(name));

DROP TRIGGER IF EXISTS update_storage_locations_updated_at ON public.storage_locations;
CREATE TRIGGER update_storage_locations_updated_at
BEFORE UPDATE ON public.storage_locations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
