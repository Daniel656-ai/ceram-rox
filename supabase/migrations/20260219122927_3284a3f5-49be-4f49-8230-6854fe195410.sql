
-- Fix search_path on priority_enum_to_int
CREATE OR REPLACE FUNCTION public.priority_enum_to_int(p order_priority)
RETURNS integer
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE p
    WHEN 'normal' THEN 0
    WHEN 'wichtig' THEN 1
    WHEN 'hoechste' THEN 2
  END;
$$;
