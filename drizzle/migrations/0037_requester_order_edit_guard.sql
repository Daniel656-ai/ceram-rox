CREATE OR REPLACE FUNCTION public.order_requester_block_reason(_order_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _o public.measurement_orders%ROWTYPE; _ids uuid[];
BEGIN
  SELECT * INTO _o FROM public.measurement_orders WHERE id=_order_id;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF _o.order_type = 'internal' THEN RETURN 'internal'; END IF;
  IF public.is_order_locked(_order_id) THEN RETURN 'locked'; END IF;
  IF _o.status::text <> 'open' THEN RETURN 'started'; END IF;
  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO _ids FROM public.order_measurements WHERE order_id=_order_id;
  IF EXISTS(SELECT 1 FROM public.order_measurements WHERE id=ANY(_ids) AND (status::text <> 'open' OR coalesce(actual_duration_hours,0)>0))
    OR EXISTS(SELECT 1 FROM public.order_workflow_tasks WHERE order_id=_order_id AND
      (status NOT IN ('open','pending','planned','entwurf','geplant') OR opened_at IS NOT NULL OR completed_at IS NOT NULL OR time_entry_id IS NOT NULL OR coalesce(auto_time_minutes,0)>0 OR coalesce(form_response,'{}'::jsonb) <> '{}'::jsonb))
    OR EXISTS(SELECT 1 FROM public.order_step_runs WHERE order_id=_order_id AND
      (status::text NOT IN ('pending','open') OR opened_at IS NOT NULL OR completed_at IS NOT NULL OR time_entry_id IS NOT NULL OR coalesce(auto_time_minutes,0)>0 OR coalesce(form_response,'{}'::jsonb) <> '{}'::jsonb))
    OR EXISTS(SELECT 1 FROM public.order_processes WHERE order_id=_order_id AND
      (status NOT IN ('pending','open','planned','entwurf','geplant') OR started_at IS NOT NULL OR completed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM public.pilot_plant_blocks WHERE order_id=_order_id AND
      (status::text <> 'pending' OR started_at IS NOT NULL OR completed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM public.measurement_results WHERE order_measurement_id=ANY(_ids) AND measured_by IS DISTINCT FROM _o.created_by)
    OR EXISTS(SELECT 1 FROM public.measurement_raw_datasets WHERE order_measurement_id=ANY(_ids))
    OR EXISTS(SELECT 1 FROM public.measurement_result_corrections WHERE order_measurement_id=ANY(_ids))
    OR EXISTS(SELECT 1 FROM public.measurement_import_operations WHERE order_measurement_id=ANY(_ids))
    OR EXISTS(SELECT 1 FROM public.work_logs WHERE order_measurement_id=ANY(_ids))
    OR EXISTS(SELECT 1 FROM public.project_time_entries WHERE order_id=_order_id)
    OR EXISTS(SELECT 1 FROM public.project_knetung_materials WHERE order_measurement_id=ANY(_ids))
    OR EXISTS(SELECT 1 FROM public.pilot_plant_produced_samples WHERE order_id=_order_id) THEN
    RETURN 'started';
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.order_requester_edit_state(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _o public.measurement_orders%ROWTYPE; _reason text; _allowed boolean;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('can_edit',false,'reason','not_authenticated'); END IF;
  SELECT * INTO _o FROM public.measurement_orders WHERE id=_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('can_edit',false,'reason','not_found'); END IF;
  _allowed := public.has_role(_uid,'master'::public.app_role)
    OR (_o.created_by = _uid AND public.has_role(_uid,'auftraggeber'::public.app_role));
  IF NOT _allowed THEN RETURN jsonb_build_object('can_edit',false,'reason','forbidden'); END IF;
  _reason := public.order_requester_block_reason(_order_id);
  RETURN jsonb_build_object('can_edit', _reason IS NULL, 'reason', _reason);
END $$;

CREATE OR REPLACE FUNCTION public.guard_requester_order_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _order_id uuid; _creator uuid; _invoker text := current_setting('role', true);
BEGIN
  -- Nur direkte Client-Schreibzugriffe prüfen; SECURITY-DEFINER-RPCs (z. B. amend_order_spec) und Folgetrigger bleiben unberührt.
  IF _uid IS NULL OR coalesce(_invoker,'') <> 'authenticated' OR pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF public.has_role(_uid,'master'::public.app_role) THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_TABLE_NAME = 'measurement_orders' THEN
    _order_id := NEW.id; _creator := OLD.created_by;
    IF (to_jsonb(NEW) - 'updated_at' - 'status') = (to_jsonb(OLD) - 'updated_at' - 'status') THEN RETURN NEW; END IF;
  ELSE
    SELECT om.order_id, mo.created_by INTO _order_id, _creator
      FROM public.order_measurements om JOIN public.measurement_orders mo ON mo.id = om.order_id
      WHERE om.id = COALESCE(NEW.order_measurement_id, OLD.order_measurement_id);
  END IF;
  IF _creator = _uid AND public.order_requester_block_reason(_order_id) IS NOT NULL THEN
    RAISE EXCEPTION 'Dieser Auftrag kann nicht mehr bearbeitet werden, da die Bearbeitung durch einen Messdienstleister bereits begonnen hat.' USING ERRCODE='42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_guard_requester_order_edit ON public.measurement_orders;
CREATE TRIGGER trg_guard_requester_order_edit BEFORE UPDATE ON public.measurement_orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_requester_order_edit();
DROP TRIGGER IF EXISTS trg_guard_requester_param_edit ON public.measurement_parameters;
CREATE TRIGGER trg_guard_requester_param_edit BEFORE INSERT OR UPDATE OR DELETE ON public.measurement_parameters
  FOR EACH ROW EXECUTE FUNCTION public.guard_requester_order_edit();

CREATE OR REPLACE FUNCTION public.requester_remove_order_measurement(_measurement_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _m public.order_measurements%ROWTYPE; _o public.measurement_orders%ROWTYPE; _snap jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Bitte erneut anmelden.' USING ERRCODE='42501'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN RAISE EXCEPTION 'Begründung (mind. 5 Zeichen) erforderlich.'; END IF;
  SELECT * INTO _m FROM public.order_measurements WHERE id=_measurement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dienstleistung nicht vorhanden.' USING ERRCODE='P0002'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('order_delete:' || _m.order_id::text, 0));
  SELECT * INTO _o FROM public.measurement_orders WHERE id=_m.order_id FOR UPDATE;
  SELECT * INTO _m FROM public.order_measurements WHERE id=_measurement_id FOR UPDATE;
  IF NOT (public.has_role(_uid,'master'::public.app_role)
     OR (_o.created_by = _uid AND public.has_role(_uid,'auftraggeber'::public.app_role))) THEN
    RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501';
  END IF;
  IF public.order_requester_block_reason(_o.id) IS NOT NULL THEN
    RAISE EXCEPTION 'Dieser Auftrag kann nicht mehr bearbeitet werden, da die Bearbeitung durch einen Messdienstleister bereits begonnen hat.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.measurement_results WHERE order_measurement_id=_measurement_id AND measured_by IS DISTINCT FROM _o.created_by)
    OR EXISTS(SELECT 1 FROM public.order_measurements WHERE source_measurement_id=_measurement_id)
    OR EXISTS(SELECT 1 FROM public.samples WHERE prepared_for_measurement_id=_measurement_id)
    OR EXISTS(SELECT 1 FROM public.documents WHERE order_measurement_id=_measurement_id) THEN
    RAISE EXCEPTION 'Diese Dienstleistung enthält geschützte Daten und kann nicht entfernt werden.';
  END IF;
  _snap := jsonb_build_object('measurement', to_jsonb(_m),
    'parameters', coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM public.measurement_parameters p WHERE order_measurement_id=_measurement_id),'[]'::jsonb),
    'reason', btrim(_reason), 'order_number', _o.order_number, 'removed_order_measurement_id', _measurement_id);
  UPDATE public.activity_log SET order_measurement_id=NULL,
    metadata = metadata || jsonb_build_object('deleted_measurement_id', _measurement_id)
    WHERE order_measurement_id=_measurement_id;
  INSERT INTO public.activity_log(event_type, actor_user_id, project_id, order_id, metadata)
    VALUES ('order_measurement_removed_by_requester', _uid, _o.project_id, _o.id, _snap);
  DELETE FROM public.measurement_results WHERE order_measurement_id=_measurement_id;
  DELETE FROM public.order_measurements WHERE id=_measurement_id;
  RETURN _measurement_id;
END $$;

REVOKE ALL ON FUNCTION public.order_requester_block_reason(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.order_requester_edit_state(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.requester_remove_order_measurement(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_requester_edit_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.requester_remove_order_measurement(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.order_requester_block_reason(uuid) TO authenticated;