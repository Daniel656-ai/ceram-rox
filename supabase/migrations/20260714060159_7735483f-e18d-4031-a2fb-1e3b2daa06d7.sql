
-- =========================================================================
-- Auto-Abschluss + Schreibschutz für abgeschlossene Aufträge
-- =========================================================================

-- 1) Lock-Helper -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_order_locked(_order_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT workflow_status = 'abgeschlossen'
       FROM public.measurement_orders WHERE id = _order_id),
    false
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_order_locked(UUID) TO authenticated;

-- Bypass-Flag (nur für interne DB-Trigger, nie durch Anwendungscode)
CREATE OR REPLACE FUNCTION public._order_lock_bypass()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.bypass_order_lock', true) = 'on', false);
$$;

-- 2) Generische Lock-Trigger-Funktionen ------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_order_lock_on_children()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id UUID;
BEGIN
  IF public._order_lock_bypass() THEN RETURN COALESCE(NEW, OLD); END IF;

  v_order_id := CASE TG_TABLE_NAME
    WHEN 'order_workflow_tasks'          THEN COALESCE(NEW.order_id, OLD.order_id)
    WHEN 'order_workflow_task_positions' THEN (SELECT order_id FROM public.order_workflow_tasks WHERE id = COALESCE(NEW.task_id, OLD.task_id))
    WHEN 'order_measurements'            THEN COALESCE(NEW.order_id, OLD.order_id)
    WHEN 'measurement_results'           THEN (SELECT order_id FROM public.order_measurements WHERE id = COALESCE(NEW.order_measurement_id, OLD.order_measurement_id))
    WHEN 'work_logs'                     THEN (SELECT order_id FROM public.order_measurements WHERE id = COALESCE(NEW.order_measurement_id, OLD.order_measurement_id))
    WHEN 'project_time_entries'          THEN COALESCE(NEW.order_id, OLD.order_id)
    ELSE NULL
  END;

  IF v_order_id IS NOT NULL AND public.is_order_locked(v_order_id) THEN
    RAISE EXCEPTION 'Auftrag ist abgeschlossen und schreibgeschützt. Änderungen sind nur über einen Korrekturprozess zulässig.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE OR REPLACE FUNCTION public.enforce_order_lock_on_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public._order_lock_bypass() THEN RETURN NEW; END IF;
  IF OLD.workflow_status = 'abgeschlossen' THEN
    -- Erlaube nur harmlose Felder (ranking, notes gesperrt). Alles blockieren.
    RAISE EXCEPTION 'Auftrag ist abgeschlossen und schreibgeschützt.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END; $$;

-- 3) Lock-Trigger anhängen -------------------------------------------------
DROP TRIGGER IF EXISTS trg_lock_measurement_orders ON public.measurement_orders;
CREATE TRIGGER trg_lock_measurement_orders
  BEFORE UPDATE OR DELETE ON public.measurement_orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_lock_on_order();

DROP TRIGGER IF EXISTS trg_lock_owt ON public.order_workflow_tasks;
CREATE TRIGGER trg_lock_owt
  BEFORE INSERT OR UPDATE OR DELETE ON public.order_workflow_tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_lock_on_children();

DROP TRIGGER IF EXISTS trg_lock_owtp ON public.order_workflow_task_positions;
CREATE TRIGGER trg_lock_owtp
  BEFORE INSERT OR UPDATE OR DELETE ON public.order_workflow_task_positions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_lock_on_children();

DROP TRIGGER IF EXISTS trg_lock_om ON public.order_measurements;
CREATE TRIGGER trg_lock_om
  BEFORE INSERT OR UPDATE OR DELETE ON public.order_measurements
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_lock_on_children();

DROP TRIGGER IF EXISTS trg_lock_mr ON public.measurement_results;
CREATE TRIGGER trg_lock_mr
  BEFORE INSERT OR UPDATE OR DELETE ON public.measurement_results
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_lock_on_children();

DROP TRIGGER IF EXISTS trg_lock_wl ON public.work_logs;
CREATE TRIGGER trg_lock_wl
  BEFORE INSERT OR UPDATE OR DELETE ON public.work_logs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_lock_on_children();

DROP TRIGGER IF EXISTS trg_lock_pte ON public.project_time_entries;
CREATE TRIGGER trg_lock_pte
  BEFORE UPDATE OR DELETE ON public.project_time_entries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_lock_on_children();

-- 4) Auto-Abschluss im Workflow-Trigger ------------------------------------
CREATE OR REPLACE FUNCTION public.wf_task_after_complete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id UUID := NEW.order_id;
  v_project_id UUID;
  v_minutes INTEGER;
  v_new_time_id UUID;
  v_total INTEGER;
  v_done INTEGER;
  v_position_gaps INTEGER;
  v_creator UUID;
  v_order_no TEXT;
  v_activity_id UUID;
BEGIN
  IF NEW.status <> 'completed' OR COALESCE(OLD.status,'') = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Positions-Pflichtprüfung
  SELECT COUNT(*) INTO v_position_gaps
  FROM public.order_workflow_task_positions p
  WHERE p.task_id = NEW.id
    AND NOT (
      (p.result_value IS NOT NULL AND btrim(p.result_value) <> '')
      OR (p.status = 'not_feasible' AND p.not_feasible_reason IS NOT NULL
          AND btrim(p.not_feasible_reason) <> '')
    );
  IF v_position_gaps > 0 THEN
    RAISE EXCEPTION 'Abschluss nicht möglich: % Positionen ohne Ergebnis oder Begründung.', v_position_gaps
      USING ERRCODE = 'check_violation';
  END IF;

  -- shared_form_data mergen
  IF NEW.form_response IS NOT NULL AND jsonb_typeof(NEW.form_response) = 'object' THEN
    PERFORM set_config('app.bypass_order_lock', 'on', true);
    UPDATE public.measurement_orders
       SET shared_form_data = COALESCE(shared_form_data, '{}'::jsonb) || NEW.form_response,
           updated_at = now()
     WHERE id = v_order_id;
    PERFORM set_config('app.bypass_order_lock', 'off', true);
  END IF;

  -- Zeitbuchung anlegen
  IF NEW.assigned_to IS NOT NULL
     AND NEW.opened_at IS NOT NULL
     AND NEW.completed_at IS NOT NULL
     AND NEW.time_entry_id IS NULL THEN

    v_minutes := GREATEST(
      15,
      (CEIL(EXTRACT(EPOCH FROM (NEW.completed_at - NEW.opened_at))/60.0/15.0) * 15)::int
    );
    SELECT project_id INTO v_project_id FROM public.measurement_orders WHERE id = v_order_id;

    IF v_project_id IS NOT NULL THEN
      INSERT INTO public.project_time_entries (
        project_id, person_id, entry_date, duration_minutes, note, order_id
      ) VALUES (
        v_project_id, NEW.assigned_to,
        (NEW.completed_at AT TIME ZONE 'UTC')::date,
        v_minutes,
        'Workflow-Schritt automatisch (Task ' || NEW.id::text || ')',
        v_order_id
      )
      RETURNING id INTO v_new_time_id;

      PERFORM set_config('app.bypass_order_lock', 'on', true);
      UPDATE public.order_workflow_tasks
         SET time_entry_id = v_new_time_id, auto_time_minutes = v_minutes
       WHERE id = NEW.id;
      PERFORM set_config('app.bypass_order_lock', 'off', true);
    END IF;
  END IF;

  -- Instance-Status neu berechnen
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE status IN ('completed','skipped'))::int
  INTO v_total, v_done
  FROM public.order_workflow_tasks
  WHERE instance_id = NEW.instance_id;

  IF v_total > 0 AND v_done = v_total THEN
    PERFORM set_config('app.bypass_order_lock', 'on', true);

    UPDATE public.order_workflow_instances
       SET status = 'completed', completed_at = now(), updated_at = now()
     WHERE id = NEW.instance_id AND status <> 'completed';

    INSERT INTO public.order_reports (order_id, current_version_no, auto_generated)
    VALUES (v_order_id, 0, true)
    ON CONFLICT DO NOTHING;

    -- Auftrag automatisch abschließen + sperren
    UPDATE public.measurement_orders
       SET workflow_status = 'abgeschlossen',
           status = 'completed',
           updated_at = now()
     WHERE id = v_order_id
       AND COALESCE(workflow_status::text, '') <> 'abgeschlossen'
    RETURNING created_by, order_number INTO v_creator, v_order_no;

    PERFORM set_config('app.bypass_order_lock', 'off', true);

    -- Benachrichtigung Auftraggeber
    IF v_creator IS NOT NULL THEN
      INSERT INTO public.activity_log (event_type, actor_user_id, order_id, project_id, metadata)
      VALUES (
        'order_auto_completed', NEW.assigned_to, v_order_id,
        (SELECT project_id FROM public.measurement_orders WHERE id = v_order_id),
        jsonb_build_object(
          'order_number', v_order_no,
          'message', 'Der Auftrag wurde erfolgreich abgeschlossen. Alle Ergebnisse wurden erfasst und stehen zur Einsicht bereit.'
        )
      )
      RETURNING id INTO v_activity_id;

      INSERT INTO public.notifications (user_id, activity_id)
      VALUES (v_creator, v_activity_id)
      ON CONFLICT DO NOTHING;
    END IF;

  ELSIF v_done > 0 THEN
    UPDATE public.order_workflow_instances
       SET status = 'in_progress', updated_at = now()
     WHERE id = NEW.instance_id AND status = 'pending';
  END IF;

  RETURN NEW;
END; $$;

-- 5) wf_start_task ebenfalls sperren --------------------------------------
CREATE OR REPLACE FUNCTION public.wf_start_task(_task_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order UUID;
BEGIN
  SELECT order_id INTO v_order FROM public.order_workflow_tasks WHERE id = _task_id;
  IF v_order IS NULL THEN RETURN; END IF;
  IF public.is_order_locked(v_order) THEN
    RAISE EXCEPTION 'Auftrag ist abgeschlossen und schreibgeschützt.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.order_workflow_tasks
     SET status = CASE WHEN status = 'pending' THEN 'in_progress' ELSE status END,
         opened_at = COALESCE(opened_at, now()),
         assigned_to = COALESCE(assigned_to, auth.uid()),
         updated_at = now()
   WHERE id = _task_id;

  PERFORM public.wf_seed_positions_for_task(_task_id);
END; $$;
