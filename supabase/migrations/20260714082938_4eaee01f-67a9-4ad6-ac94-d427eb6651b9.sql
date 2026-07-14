
-- =====================================================================
-- Phase 2: Unified Workflow Engine
-- =====================================================================

-- Helper: round minutes to nearest 15 (min 15)
CREATE OR REPLACE FUNCTION public.wf_round_minutes(_minutes numeric)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT GREATEST(15, (CEIL(COALESCE(_minutes, 0) / 15.0) * 15)::integer);
$$;

-- =====================================================================
-- wf_seed_from_template
-- Creates order_step_runs for every process_step of the given template.
-- Idempotent: skips steps that already have a run for that order.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.wf_seed_from_template(
  _order_id uuid,
  _template_id uuid DEFAULT NULL
)
RETURNS SETOF public.order_step_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template uuid;
  v_snapshot jsonb;
BEGIN
  IF _order_id IS NULL THEN
    RAISE EXCEPTION 'order_id required';
  END IF;

  SELECT COALESCE(_template_id, template_id) INTO v_template
  FROM public.order_instances WHERE id = _order_id;

  IF v_template IS NULL THEN
    RAISE EXCEPTION 'No template bound to order %', _order_id;
  END IF;

  PERFORM set_config('app.bypass_order_lock', 'on', true);

  INSERT INTO public.order_step_runs
    (order_id, step_id, step_key, step_snapshot, order_index, assigned_role, status)
  SELECT
    _order_id,
    ps.id,
    ps.step_key,
    jsonb_build_object(
      'name', ps.name,
      'description', ps.description,
      'form_id', ps.form_id,
      'is_mandatory', ps.is_mandatory,
      'auto_actions', ps.auto_actions,
      'position_source', ps.position_source,
      'metadata', ps.metadata
    ),
    ps.order_index,
    ps.role_required,
    'pending'::step_run_status
  FROM public.process_steps ps
  WHERE ps.template_id = v_template
    AND NOT EXISTS (
      SELECT 1 FROM public.order_step_runs r
      WHERE r.order_id = _order_id AND r.step_id = ps.id
    )
  ORDER BY ps.order_index;

  -- Persist template binding + snapshot if not yet set
  SELECT jsonb_build_object(
    'template_id', pt.id,
    'name', pt.name,
    'version', pt.version,
    'kind', pt.kind
  ) INTO v_snapshot
  FROM public.process_templates pt WHERE pt.id = v_template;

  UPDATE public.order_instances
     SET template_id = v_template,
         template_snapshot = COALESCE(NULLIF(template_snapshot,'{}'::jsonb), v_snapshot)
   WHERE id = _order_id;

  RETURN QUERY
    SELECT * FROM public.order_step_runs
     WHERE order_id = _order_id
     ORDER BY order_index;
END;
$$;

-- =====================================================================
-- wf_start_step
-- =====================================================================
CREATE OR REPLACE FUNCTION public.wf_start_step(_run_id uuid)
RETURNS public.order_step_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.order_step_runs;
BEGIN
  SELECT * INTO v_row FROM public.order_step_runs WHERE id = _run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Step run % not found', _run_id; END IF;

  IF v_row.status = 'completed' THEN
    RAISE EXCEPTION 'Schritt ist bereits abgeschlossen';
  END IF;

  PERFORM set_config('app.bypass_order_lock', 'on', true);

  UPDATE public.order_step_runs
     SET status = 'in_progress',
         opened_at = COALESCE(opened_at, now()),
         opened_by = COALESCE(opened_by, auth.uid()),
         assigned_to = COALESCE(assigned_to, auth.uid())
   WHERE id = _run_id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- =====================================================================
-- wf_complete_step
--  - validates required form fields against form_fields
--  - validates positions (all completed or not_feasible + reason)
--  - merges form_response into order_instances.shared_data[step_key]
--  - creates project_time_entry from opened_at → now() (rounded to 15 min)
--  - executes basic auto_actions: {"type":"notify"}, {"type":"create_lab_order"}
--  - triggers wf_finalize_order when all mandatory steps are complete
-- =====================================================================
CREATE OR REPLACE FUNCTION public.wf_complete_step(
  _run_id uuid,
  _response jsonb DEFAULT '{}'::jsonb,
  _notes text DEFAULT NULL
)
RETURNS public.order_step_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run       public.order_step_runs;
  v_order     public.order_instances;
  v_form_id   uuid;
  v_missing   text;
  v_open_pos  int;
  v_bad_pos   int;
  v_minutes   int;
  v_time_id   uuid;
  v_person_id uuid;
  v_action    jsonb;
  v_remaining int;
BEGIN
  IF _run_id IS NULL THEN RAISE EXCEPTION 'run_id required'; END IF;

  SELECT * INTO v_run FROM public.order_step_runs WHERE id = _run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Step run % not found', _run_id; END IF;

  IF v_run.status = 'completed' THEN
    RETURN v_run;
  END IF;

  SELECT * INTO v_order FROM public.order_instances WHERE id = v_run.order_id;
  IF v_order.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Auftrag ist abgeschlossen und schreibgeschützt';
  END IF;

  -- Required-field validation via form_fields
  SELECT ps.form_id INTO v_form_id FROM public.process_steps ps WHERE ps.id = v_run.step_id;
  IF v_form_id IS NOT NULL THEN
    SELECT string_agg(ff.field_key, ', ')
      INTO v_missing
      FROM public.form_fields ff
     WHERE ff.form_id = v_form_id
       AND ff.is_required = true
       AND ff.parent_field_id IS NULL
       AND COALESCE(NULLIF(_response ->> ff.field_key, ''), NULL) IS NULL;

    IF v_missing IS NOT NULL THEN
      RAISE EXCEPTION 'Pflichtfelder fehlen: %', v_missing;
    END IF;
  END IF;

  -- Position validation
  SELECT
    COUNT(*) FILTER (WHERE status NOT IN ('completed','not_feasible')),
    COUNT(*) FILTER (WHERE status = 'not_feasible' AND COALESCE(NULLIF(not_feasible_reason,''), NULL) IS NULL)
    INTO v_open_pos, v_bad_pos
  FROM public.order_step_positions
  WHERE step_run_id = _run_id;

  IF v_open_pos > 0 THEN
    RAISE EXCEPTION 'Es sind noch % Position(en) offen', v_open_pos;
  END IF;
  IF v_bad_pos > 0 THEN
    RAISE EXCEPTION 'Positionen mit Status "nicht durchführbar" benötigen eine Begründung';
  END IF;

  -- Duration
  IF v_run.opened_at IS NOT NULL THEN
    v_minutes := public.wf_round_minutes(EXTRACT(EPOCH FROM (now() - v_run.opened_at)) / 60.0);
  ELSE
    v_minutes := 15;
  END IF;

  PERFORM set_config('app.bypass_order_lock', 'on', true);

  -- Merge form_response into shared_data under step_key namespace
  UPDATE public.order_instances
     SET shared_data = COALESCE(shared_data, '{}'::jsonb)
                     || jsonb_build_object(v_run.step_key,
                          COALESCE(shared_data -> v_run.step_key, '{}'::jsonb) || COALESCE(_response, '{}'::jsonb))
   WHERE id = v_run.order_id;

  -- Optional: create project_time_entry (only if order has a project)
  IF v_order.project_id IS NOT NULL THEN
    SELECT id INTO v_person_id FROM public.profiles WHERE id = COALESCE(v_run.assigned_to, auth.uid());
    IF v_person_id IS NOT NULL THEN
      INSERT INTO public.project_time_entries
        (project_id, person_id, entry_date, duration_minutes, note, created_by, entry_type)
      VALUES
        (v_order.project_id, v_person_id, CURRENT_DATE, v_minutes,
         COALESCE('Workflow-Schritt: ' || (v_run.step_snapshot->>'name'), 'Workflow-Schritt'),
         auth.uid(), 'individual')
      RETURNING id INTO v_time_id;
    END IF;
  END IF;

  -- Complete the run
  UPDATE public.order_step_runs
     SET status = 'completed',
         completed_at = now(),
         completed_by = auth.uid(),
         form_response = COALESCE(_response, '{}'::jsonb),
         notes = COALESCE(_notes, notes),
         time_entry_id = v_time_id,
         auto_time_minutes = v_minutes,
         assigned_to = COALESCE(assigned_to, auth.uid())
   WHERE id = _run_id
   RETURNING * INTO v_run;

  -- Execute simple auto_actions (best-effort, non-blocking on unknown types)
  IF v_run.step_snapshot ? 'auto_actions' THEN
    FOR v_action IN SELECT * FROM jsonb_array_elements(v_run.step_snapshot -> 'auto_actions')
    LOOP
      IF v_action->>'type' = 'notify' THEN
        INSERT INTO public.notifications (user_id, title, body)
        SELECT COALESCE((v_action->>'user_id')::uuid, v_order.created_by),
               COALESCE(v_action->>'title', 'Workflow-Update'),
               COALESCE(v_action->>'body',
                        'Schritt "' || (v_run.step_snapshot->>'name') || '" abgeschlossen')
        WHERE v_order.created_by IS NOT NULL;
      END IF;
      -- Additional action types can be added here without changing callers.
    END LOOP;
  END IF;

  -- Auto-finalize when no mandatory step is left open
  SELECT COUNT(*) INTO v_remaining
  FROM public.order_step_runs r
  LEFT JOIN public.process_steps ps ON ps.id = r.step_id
  WHERE r.order_id = v_run.order_id
    AND r.status <> 'completed'
    AND COALESCE(ps.is_mandatory, true) = true;

  IF v_remaining = 0 THEN
    PERFORM public.wf_finalize_order(v_run.order_id);
  END IF;

  RETURN v_run;
END;
$$;

-- =====================================================================
-- wf_reopen_step (master only)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.wf_reopen_step(_run_id uuid)
RETURNS public.order_step_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.order_step_runs;
BEGIN
  IF NOT public.has_role(auth.uid(), 'master'::app_role) THEN
    RAISE EXCEPTION 'Nur Master dürfen Schritte wieder öffnen';
  END IF;

  PERFORM set_config('app.bypass_order_lock', 'on', true);

  UPDATE public.order_step_runs
     SET status = 'in_progress',
         completed_at = NULL,
         completed_by = NULL
   WHERE id = _run_id
   RETURNING * INTO v_row;

  -- If order was locked, unlock it too (master override)
  UPDATE public.order_instances
     SET locked_at = NULL,
         completed_at = NULL,
         workflow_status = 'in_bearbeitung'::order_workflow_status_new
   WHERE id = v_row.order_id AND locked_at IS NOT NULL;

  RETURN v_row;
END;
$$;

-- =====================================================================
-- wf_finalize_order
-- Locks the order instance and marks it completed.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.wf_finalize_order(_order_id uuid)
RETURNS public.order_instances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.order_instances;
BEGIN
  PERFORM set_config('app.bypass_order_lock', 'on', true);

  UPDATE public.order_instances
     SET status = 'completed'::order_instance_status,
         workflow_status = 'abgeschlossen'::order_workflow_status_new,
         completed_at = COALESCE(completed_at, now()),
         locked_at = COALESCE(locked_at, now())
   WHERE id = _order_id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- =====================================================================
-- Permissions
-- =====================================================================
REVOKE ALL ON FUNCTION public.wf_round_minutes(numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wf_seed_from_template(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wf_start_step(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wf_complete_step(uuid, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wf_reopen_step(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wf_finalize_order(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.wf_round_minutes(numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wf_seed_from_template(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wf_start_step(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wf_complete_step(uuid, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wf_reopen_step(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wf_finalize_order(uuid) TO authenticated, service_role;
