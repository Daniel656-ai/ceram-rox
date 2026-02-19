
-- Drop and recreate the sample number generator with proper locking
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
  current_yy := to_char(now(), 'YY');
  
  -- Use advisory lock to prevent race conditions
  PERFORM pg_advisory_xact_lock(hashtext('sample_number_' || current_yy));
  
  SELECT COALESCE(MAX(substring(sample_number from 2 for 4)::int), 0) + 1
  INTO next_val
  FROM public.samples
  WHERE sample_number LIKE 'P' || current_yy || '%';
  
  NEW.sample_number := 'P' || current_yy || lpad(next_val::text, 4, '0');
  RETURN NEW;
END;
$function$;

-- Also fix measurement number generator with same pattern
CREATE OR REPLACE FUNCTION public.generate_measurement_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_yy text;
  next_val int;
BEGIN
  current_yy := to_char(now(), 'YY');
  
  PERFORM pg_advisory_xact_lock(hashtext('measurement_number_' || current_yy));
  
  SELECT COALESCE(MAX(substring(measurement_number from 4)::int), 0) + 1
  INTO next_val
  FROM public.order_measurements
  WHERE measurement_number LIKE 'M' || current_yy || '%';
  
  NEW.measurement_number := 'M' || current_yy || lpad(next_val::text, 4, '0');
  RETURN NEW;
END;
$function$;
