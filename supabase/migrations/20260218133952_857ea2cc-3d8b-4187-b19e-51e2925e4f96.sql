
CREATE OR REPLACE FUNCTION public.generate_sample_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_yy text;
  next_val int;
  max_existing int;
BEGIN
  current_yy := to_char(now(), 'YY');
  
  SELECT COALESCE(MAX(substring(sample_number from 3)::int), 0)
  INTO max_existing
  FROM public.samples
  WHERE sample_number LIKE current_yy || '%';
  
  next_val := max_existing + 1;
  
  NEW.sample_number := current_yy || lpad(next_val::text, 4, '0');
  RETURN NEW;
END;
$$;
