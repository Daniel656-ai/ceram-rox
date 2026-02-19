
-- 1. Update sample number trigger to use P prefix
CREATE OR REPLACE FUNCTION public.generate_sample_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_yy text;
  next_val int;
  max_existing int;
BEGIN
  current_yy := to_char(now(), 'YY');
  
  SELECT COALESCE(MAX(substring(sample_number from 2 for 4)::int), 0)
  INTO max_existing
  FROM public.samples
  WHERE sample_number LIKE 'P' || current_yy || '%';
  
  -- Fallback: also check old format without P prefix
  IF max_existing = 0 THEN
    SELECT COALESCE(MAX(substring(sample_number from 3)::int), 0)
    INTO max_existing
    FROM public.samples
    WHERE sample_number ~ '^\d{2}\d{4}$'
    AND substring(sample_number from 1 for 2) = current_yy;
  END IF;
  
  next_val := max_existing + 1;
  NEW.sample_number := 'P' || current_yy || lpad(next_val::text, 4, '0');
  RETURN NEW;
END;
$function$;

-- 2. Update existing sample numbers to add P prefix (only those without P)
UPDATE public.samples
SET sample_number = 'P' || sample_number
WHERE sample_number NOT LIKE 'P%';

-- 3. Add measurement_number column to order_measurements
ALTER TABLE public.order_measurements
ADD COLUMN measurement_number text;

-- 4. Create trigger function for measurement numbers
CREATE OR REPLACE FUNCTION public.generate_measurement_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_yy text;
  next_val int;
  max_existing int;
BEGIN
  current_yy := to_char(now(), 'YY');
  
  SELECT COALESCE(MAX(substring(measurement_number from 4)::int), 0)
  INTO max_existing
  FROM public.order_measurements
  WHERE measurement_number LIKE 'M' || current_yy || '%';
  
  next_val := max_existing + 1;
  NEW.measurement_number := 'M' || current_yy || lpad(next_val::text, 4, '0');
  RETURN NEW;
END;
$function$;

-- 5. Create trigger
CREATE TRIGGER set_measurement_number
BEFORE INSERT ON public.order_measurements
FOR EACH ROW
EXECUTE FUNCTION public.generate_measurement_number();

-- 6. Backfill existing measurements with numbers
DO $$
DECLARE
  current_yy text;
  counter int := 0;
  rec record;
BEGIN
  current_yy := to_char(now(), 'YY');
  FOR rec IN SELECT id FROM public.order_measurements ORDER BY created_at ASC
  LOOP
    counter := counter + 1;
    UPDATE public.order_measurements
    SET measurement_number = 'M' || current_yy || lpad(counter::text, 4, '0')
    WHERE id = rec.id;
  END LOOP;
END $$;

-- 7. Make measurement_number NOT NULL and UNIQUE after backfill
ALTER TABLE public.order_measurements
ALTER COLUMN measurement_number SET NOT NULL;

ALTER TABLE public.order_measurements
ADD CONSTRAINT order_measurements_measurement_number_key UNIQUE (measurement_number);
