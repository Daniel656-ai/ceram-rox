CREATE OR REPLACE FUNCTION public.generate_sample_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_yy text;
  next_val int;
BEGIN
  -- Explizit übergebene Probennummern (z. B. m³-Beprobung) bleiben unverändert.
  IF NEW.sample_number IS NOT NULL
     AND btrim(NEW.sample_number) <> ''
     AND NEW.sample_number <> 'WILL_BE_OVERWRITTEN' THEN
    RETURN NEW;
  END IF;
  current_yy := to_char(now(), 'YY');
  PERFORM pg_advisory_xact_lock(hashtext('sample_number_' || current_yy));
  SELECT COALESCE(MAX(substring(sample_number from 4)::int), 0) + 1
  INTO next_val
  FROM public.samples
  WHERE sample_number ~ ('^P' || current_yy || '[0-9]+$');
  NEW.sample_number := 'P' || current_yy || lpad(next_val::text, 4, '0');
  RETURN NEW;
END;
$function$;