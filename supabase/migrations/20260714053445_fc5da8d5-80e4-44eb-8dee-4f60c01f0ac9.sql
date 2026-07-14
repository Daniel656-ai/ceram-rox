
-- =========================================================================
-- Workflow-Engine Fundament: gemeinsamer Auftragsdatensatz, Positionen,
-- automatische Zeiterfassung, Ergebnisbericht-Auto-Anlage, Instance-Status
-- =========================================================================

-- 1) Gemeinsamer Store am Auftrag ------------------------------------------
ALTER TABLE public.measurement_orders
  ADD COLUMN IF NOT EXISTS shared_form_data JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.measurement_orders.shared_form_data IS
'Zentraler JSON-Store: alle Workflow-Schritte lesen/schreiben in dieses Objekt.
Beim Abschluss eines Tasks wird task.form_response per Trigger flach in dieses
Objekt gemergt. Folgende Schritte prefillen ihre Formulare aus diesem Store.';

-- 2) Task-Zeit-Buchung + Validierungshelfer --------------------------------
ALTER TABLE public.order_workflow_tasks
  ADD COLUMN IF NOT EXISTS time_entry_id UUID REFERENCES public.project_time_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_time_minutes INTEGER;

-- 3) Positionen pro Task (Sample = Position) -------------------------------
CREATE TABLE IF NOT EXISTS public.order_workflow_task_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.order_workflow_tasks(id) ON DELETE CASCADE,
  sample_id UUID REFERENCES public.samples(id) ON DELETE CASCADE,
  position_label TEXT,                     -- Falls Position nicht an Sample hängt (freier Text)
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','completed','not_feasible')),
  result_value TEXT,                       -- Messergebnis (Freitext / Zahl als Text)
  remarks TEXT,                            -- Bemerkung
  not_feasible_reason TEXT,                -- Begründung falls status='not_feasible'
  completed_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, sample_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_workflow_task_positions TO authenticated;
GRANT ALL ON public.order_workflow_task_positions TO service_role;

ALTER TABLE public.order_workflow_task_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "positions_read_all_authenticated"
  ON public.order_workflow_task_positions FOR SELECT TO authenticated USING (true);

CREATE POLICY "positions_write_by_task_assignee_or_master"
  ON public.order_workflow_task_positions FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'master')
    OR EXISTS (
      SELECT 1 FROM public.order_workflow_tasks t
      WHERE t.id = order_workflow_task_positions.task_id
        AND (t.assigned_to = auth.uid() OR t.assigned_to IS NULL)
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'master')
    OR EXISTS (
      SELECT 1 FROM public.order_workflow_tasks t
      WHERE t.id = order_workflow_task_positions.task_id
        AND (t.assigned_to = auth.uid() OR t.assigned_to IS NULL)
    )
  );

CREATE INDEX IF NOT EXISTS idx_owtp_task ON public.order_workflow_task_positions(task_id);
CREATE INDEX IF NOT EXISTS idx_owtp_sample ON public.order_workflow_task_positions(sample_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_owtp_updated_at ON public.order_workflow_task_positions;
CREATE TRIGGER trg_owtp_updated_at
  BEFORE UPDATE ON public.order_workflow_task_positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Trigger: bei Task-Abschluss form_response in shared_form_data mergen,
--    Zeitbuchung anlegen, Instance-Status neu berechnen, Report anlegen ----
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
BEGIN
  -- Nur bei Übergang -> completed
  IF NEW.status <> 'completed' OR COALESCE(OLD.status,'') = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Positions-Pflichtprüfung: jede Position muss result_value ODER
  -- (status='not_feasible' UND Begründung) haben.
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

  -- shared_form_data mergen (flacher Merge auf Top-Level-Keys)
  IF NEW.form_response IS NOT NULL AND jsonb_typeof(NEW.form_response) = 'object' THEN
    UPDATE public.measurement_orders
       SET shared_form_data = COALESCE(shared_form_data, '{}'::jsonb) || NEW.form_response,
           updated_at = now()
     WHERE id = v_order_id;
  END IF;

  -- Zeitbuchung anlegen (auf 15 Min gerundet, min. 15)
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
        project_id, person_id, entry_date, duration_minutes, note
      ) VALUES (
        v_project_id, NEW.assigned_to,
        (NEW.completed_at AT TIME ZONE 'UTC')::date,
        v_minutes,
        'Workflow-Schritt automatisch (Task ' || NEW.id::text || ')'
      )
      RETURNING id INTO v_new_time_id;

      UPDATE public.order_workflow_tasks
         SET time_entry_id = v_new_time_id,
             auto_time_minutes = v_minutes
       WHERE id = NEW.id;
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
    UPDATE public.order_workflow_instances
       SET status = 'completed', completed_at = now(), updated_at = now()
     WHERE id = NEW.instance_id AND status <> 'completed';

    -- Ergebnisbericht sicherstellen (idempotent)
    INSERT INTO public.order_reports (order_id, current_version_no, auto_generated)
    VALUES (v_order_id, 0, true)
    ON CONFLICT DO NOTHING;
  ELSIF v_done > 0 THEN
    UPDATE public.order_workflow_instances
       SET status = 'in_progress', updated_at = now()
     WHERE id = NEW.instance_id AND status = 'pending';
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_wf_task_after_complete ON public.order_workflow_tasks;
CREATE TRIGGER trg_wf_task_after_complete
  AFTER UPDATE OF status ON public.order_workflow_tasks
  FOR EACH ROW EXECUTE FUNCTION public.wf_task_after_complete();

-- 5) Positionen automatisch aus Samples des Auftrags erzeugen --------------
CREATE OR REPLACE FUNCTION public.wf_seed_positions_for_task(_task_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order UUID;
  v_created INTEGER := 0;
BEGIN
  SELECT order_id INTO v_order FROM public.order_workflow_tasks WHERE id = _task_id;
  IF v_order IS NULL THEN RETURN 0; END IF;

  INSERT INTO public.order_workflow_task_positions (task_id, sample_id, position_label)
  SELECT _task_id, s.id, COALESCE(s.sample_number, s.sample_name)
    FROM public.samples s
   WHERE s.order_id = v_order
     AND NOT EXISTS (
       SELECT 1 FROM public.order_workflow_task_positions p
        WHERE p.task_id = _task_id AND p.sample_id = s.id
     );
  GET DIAGNOSTICS v_created = ROW_COUNT;
  RETURN v_created;
END; $$;

GRANT EXECUTE ON FUNCTION public.wf_seed_positions_for_task(UUID) TO authenticated;

-- 6) Task starten (setzt opened_at + status=in_progress + Positionen anlegen)
CREATE OR REPLACE FUNCTION public.wf_start_task(_task_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.order_workflow_tasks
     SET status = CASE WHEN status = 'pending' THEN 'in_progress' ELSE status END,
         opened_at = COALESCE(opened_at, now()),
         assigned_to = COALESCE(assigned_to, auth.uid()),
         updated_at = now()
   WHERE id = _task_id;

  PERFORM public.wf_seed_positions_for_task(_task_id);
END; $$;

GRANT EXECUTE ON FUNCTION public.wf_start_task(UUID) TO authenticated;
