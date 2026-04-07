
-- Add ranking column to measurement_orders (1=highest, 2, 3, NULL=no ranking/FIFO)
ALTER TABLE public.measurement_orders
  ADD COLUMN ranking integer;

-- Add ranking column to order_measurements for cascading
ALTER TABLE public.order_measurements
  ADD COLUMN ranking integer;

-- Create trigger to cascade ranking from order to measurements
CREATE OR REPLACE FUNCTION public.cascade_order_ranking_to_measurements()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.ranking IS DISTINCT FROM NEW.ranking THEN
    UPDATE order_measurements
    SET ranking = NEW.ranking
    WHERE order_id = NEW.id;

    -- Log ranking change in audit log
    INSERT INTO order_audit_log (order_id, changed_by, field_name, old_value, new_value)
    VALUES (
      NEW.id,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'ranking',
      OLD.ranking::text,
      NEW.ranking::text
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cascade_order_ranking
  AFTER UPDATE OF ranking ON public.measurement_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_order_ranking_to_measurements();

-- Sync ranking on measurement insert
CREATE OR REPLACE FUNCTION public.sync_measurement_ranking_on_insert()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  SELECT ranking INTO NEW.ranking FROM measurement_orders WHERE id = NEW.order_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_measurement_ranking_insert
  BEFORE INSERT ON public.order_measurements
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_measurement_ranking_on_insert();
