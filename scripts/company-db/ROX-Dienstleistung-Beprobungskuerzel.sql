-- ROX – Beprobungskürzel (m³-Liste) an Dienstleistungen (FIRMEN-DB)
-- NUR nach Prüfung und ausdrücklicher Freigabe durch einen Admin ausführen.
-- 1) Prüfen, ob Spalte existiert:
--    SELECT column_name FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='measurement_services' AND column_name='sampling_code';
-- 2) Falls vorhanden: vor dem Index auf Duplikate prüfen (muss leer sein):
--    SELECT lower(sampling_code), count(*) FROM public.measurement_services
--     WHERE sampling_code IS NOT NULL AND active AND archived_at IS NULL
--     GROUP BY 1 HAVING count(*) > 1;
BEGIN;
ALTER TABLE public.measurement_services ADD COLUMN IF NOT EXISTS sampling_code text;
CREATE UNIQUE INDEX IF NOT EXISTS measurement_services_sampling_code_active_idx
  ON public.measurement_services (lower(sampling_code))
  WHERE sampling_code IS NOT NULL AND active AND archived_at IS NULL;
COMMIT;
NOTIFY pgrst, 'reload schema';
