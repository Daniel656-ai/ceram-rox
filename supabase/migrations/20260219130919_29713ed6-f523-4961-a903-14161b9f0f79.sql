
-- 1. Add short_code to profiles (unique, 3 chars)
ALTER TABLE public.profiles ADD COLUMN short_code text;

-- Create unique index for short_code
CREATE UNIQUE INDEX idx_profiles_short_code ON public.profiles (short_code) WHERE short_code IS NOT NULL;

-- 2. Add order_number to measurement_orders
ALTER TABLE public.measurement_orders ADD COLUMN order_number text;
CREATE UNIQUE INDEX idx_measurement_orders_order_number ON public.measurement_orders (order_number) WHERE order_number IS NOT NULL;

-- 3. Trigger function to auto-generate order_number based on creator's short_code
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  creator_short_code text;
  current_yy text;
  next_val int;
  max_existing int;
BEGIN
  -- Get the short_code of the creator
  SELECT short_code INTO creator_short_code
  FROM public.profiles
  WHERE user_id = NEW.created_by;

  IF creator_short_code IS NULL OR length(creator_short_code) != 3 THEN
    RAISE EXCEPTION 'Benutzer hat kein gültiges Kurzzeichen (3 Zeichen erforderlich)';
  END IF;

  current_yy := to_char(now(), 'YY');

  -- Find the max existing number for this user+year combo
  SELECT COALESCE(MAX(substring(order_number from length(creator_short_code) + 3)::int), 0)
  INTO max_existing
  FROM public.measurement_orders
  WHERE order_number LIKE creator_short_code || current_yy || '%'
    AND created_by = NEW.created_by;

  next_val := max_existing + 1;
  NEW.order_number := upper(creator_short_code) || current_yy || lpad(next_val::text, 4, '0');
  RETURN NEW;
END;
$function$;

-- 4. Create trigger
CREATE TRIGGER trg_generate_order_number
BEFORE INSERT ON public.measurement_orders
FOR EACH ROW
EXECUTE FUNCTION public.generate_order_number();
