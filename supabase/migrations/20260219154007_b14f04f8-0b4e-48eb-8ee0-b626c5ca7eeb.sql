
-- Fix: extract only the sequence number (position 4 onwards = NNNN), not YYNN
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
  
  PERFORM pg_advisory_xact_lock(hashtext('sample_number_' || current_yy));
  
  SELECT COALESCE(MAX(substring(sample_number from 4)::int), 0) + 1
  INTO next_val
  FROM public.samples
  WHERE sample_number LIKE 'P' || current_yy || '%';
  
  NEW.sample_number := 'P' || current_yy || lpad(next_val::text, 4, '0');
  RETURN NEW;
END;
$function$;
