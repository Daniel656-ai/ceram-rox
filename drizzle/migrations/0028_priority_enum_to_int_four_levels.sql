CREATE OR REPLACE FUNCTION public.priority_enum_to_int(p order_priority)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE p
    WHEN 'niedrig' THEN 0
    WHEN 'normal' THEN 1
    WHEN 'wichtig' THEN 2
    WHEN 'hoch' THEN 2
    WHEN 'hoechste' THEN 3
    WHEN 'sehr_hoch' THEN 3
  END;
$function$;