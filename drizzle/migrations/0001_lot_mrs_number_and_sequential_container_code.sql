-- 1) MRS-Nummer am LOT (additiv, optional)
ALTER TABLE public.raw_material_batches
  ADD COLUMN IF NOT EXISTS mrs_number text;

-- Einmalige Übernahme: nur wenn der Rohstoff genau ein LOT besitzt
UPDATE public.raw_material_batches b
SET mrs_number = rm.mrs_number
FROM public.raw_materials rm
WHERE rm.id = b.raw_material_id
  AND rm.mrs_number IS NOT NULL
  AND length(btrim(rm.mrs_number)) > 0
  AND b.mrs_number IS NULL
  AND (SELECT count(*) FROM public.raw_material_batches b2 WHERE b2.raw_material_id = rm.id) = 1;

-- Eindeutigkeit der MRS-Nummer (leere Werte unbegrenzt)
CREATE UNIQUE INDEX IF NOT EXISTS raw_material_batches_mrs_number_uniq
  ON public.raw_material_batches (lower(btrim(mrs_number)))
  WHERE mrs_number IS NOT NULL AND length(btrim(mrs_number)) > 0;

-- 2) Gebinde-ID fortlaufend, unabhängig von Rohstoff und LOT
CREATE OR REPLACE FUNCTION public.generate_container_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_next int;
BEGIN
  IF NEW.container_code IS NOT NULL AND length(NEW.container_code) > 0 THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('container_code_seq'));

  SELECT COALESCE(MAX(substring(container_code FROM 5)::int), 0) + 1
    INTO v_next
    FROM raw_material_containers
    WHERE container_code ~ '^GEB-[0-9]+$';

  NEW.container_code := 'GEB-' || lpad(v_next::text, 3, '0');
  RETURN NEW;
END;
$$;