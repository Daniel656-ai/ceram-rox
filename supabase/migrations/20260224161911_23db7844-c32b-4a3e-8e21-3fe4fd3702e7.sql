
-- Trigger: when a measurement status changes, sync order status
CREATE OR REPLACE FUNCTION public.sync_order_status_on_measurement_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total_count int;
  completed_count int;
  in_progress_count int;
  current_order_status order_status;
  new_order_status order_status;
BEGIN
  -- Only act on status changes
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get current order status
  SELECT status INTO current_order_status FROM measurement_orders WHERE id = NEW.order_id;

  -- Count measurement statuses for this order
  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'completed'),
    count(*) FILTER (WHERE status = 'in_progress')
  INTO total_count, completed_count, in_progress_count
  FROM order_measurements WHERE order_id = NEW.order_id;

  -- Determine new order status
  IF completed_count = total_count AND total_count > 0 THEN
    new_order_status := 'completed';
  ELSIF (in_progress_count + completed_count) > 0 THEN
    new_order_status := 'in_progress';
  ELSE
    new_order_status := 'open';
  END IF;

  -- Update order if status changed
  IF current_order_status IS DISTINCT FROM new_order_status THEN
    UPDATE measurement_orders SET status = new_order_status WHERE id = NEW.order_id;

    -- Audit log entry
    INSERT INTO order_audit_log (order_id, changed_by, field_name, old_value, new_value)
    VALUES (
      NEW.order_id,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'status',
      current_order_status::text,
      new_order_status::text
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_order_status_on_measurement
  AFTER UPDATE OF status ON public.order_measurements
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_order_status_on_measurement_change();
