CREATE OR REPLACE FUNCTION public.enforce_order_lock_on_children()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  IF public._order_lock_bypass() THEN RETURN COALESCE(NEW, OLD); END IF;

  IF TG_TABLE_NAME = 'order_workflow_tasks' THEN
    v_order_id := COALESCE(NEW.order_id, OLD.order_id);
  ELSIF TG_TABLE_NAME = 'order_workflow_task_positions' THEN
    SELECT order_id INTO v_order_id
    FROM public.order_workflow_tasks
    WHERE id = COALESCE(NEW.task_id, OLD.task_id);
  ELSIF TG_TABLE_NAME = 'order_measurements' THEN
    v_order_id := COALESCE(NEW.order_id, OLD.order_id);
  ELSIF TG_TABLE_NAME = 'measurement_results' THEN
    SELECT order_id INTO v_order_id
    FROM public.order_measurements
    WHERE id = COALESCE(NEW.order_measurement_id, OLD.order_measurement_id);
  ELSIF TG_TABLE_NAME = 'work_logs' THEN
    SELECT order_id INTO v_order_id
    FROM public.order_measurements
    WHERE id = COALESCE(NEW.order_measurement_id, OLD.order_measurement_id);
  ELSIF TG_TABLE_NAME = 'project_time_entries' THEN
    v_order_id := COALESCE(NEW.order_id, OLD.order_id);
  ELSE
    v_order_id := NULL;
  END IF;

  IF v_order_id IS NOT NULL AND public.is_order_locked(v_order_id) THEN
    RAISE EXCEPTION 'Auftrag ist abgeschlossen und schreibgeschützt. Änderungen sind nur über einen Korrekturprozess zulässig.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;