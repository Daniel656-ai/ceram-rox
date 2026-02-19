
-- Function to map order_priority enum to integer for order_measurements
CREATE OR REPLACE FUNCTION public.priority_enum_to_int(p order_priority)
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p
    WHEN 'normal' THEN 0
    WHEN 'wichtig' THEN 1
    WHEN 'hoechste' THEN 2
  END;
$$;

-- Trigger: On INSERT into order_measurements, copy priority from parent order
CREATE OR REPLACE FUNCTION public.sync_measurement_priority_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  order_prio order_priority;
BEGIN
  SELECT priority INTO order_prio FROM measurement_orders WHERE id = NEW.order_id;
  NEW.priority := priority_enum_to_int(order_prio);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_measurement_priority_insert
BEFORE INSERT ON public.order_measurements
FOR EACH ROW
EXECUTE FUNCTION public.sync_measurement_priority_on_insert();

-- Trigger: On UPDATE of measurement_orders.priority, cascade to all child measurements
CREATE OR REPLACE FUNCTION public.cascade_order_priority_to_measurements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    UPDATE order_measurements
    SET priority = priority_enum_to_int(NEW.priority)
    WHERE order_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cascade_order_priority
AFTER UPDATE ON public.measurement_orders
FOR EACH ROW
EXECUTE FUNCTION public.cascade_order_priority_to_measurements();

-- Sync existing data
UPDATE order_measurements om
SET priority = public.priority_enum_to_int(mo.priority)
FROM measurement_orders mo
WHERE om.order_id = mo.id;
