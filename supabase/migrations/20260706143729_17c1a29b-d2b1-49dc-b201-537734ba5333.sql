-- Deduplicate existing service_packages by name (keep oldest), then enforce unique name
DELETE FROM public.service_packages a
USING public.service_packages b
WHERE a.name = b.name AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS service_packages_name_unique_idx
  ON public.service_packages (lower(name));