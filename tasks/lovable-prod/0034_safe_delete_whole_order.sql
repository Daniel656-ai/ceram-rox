CREATE OR REPLACE FUNCTION public.enforce_order_lock_on_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._order_lock_bypass() AND TG_OP <> 'INSERT' AND OLD.workflow_status = 'abgeschlossen' THEN
    RAISE EXCEPTION 'Auftrag ist abgeschlossen und schreibgeschützt.' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.trg_recompute_workflow_from_measurements()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN _id := OLD.order_id; ELSE _id := NEW.order_id; END IF;
  IF EXISTS (SELECT 1 FROM public.measurement_orders WHERE id = _id AND order_type <> 'internal') THEN
    PERFORM public.recompute_order_workflow_status(_id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_or_delete_order(_order_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _order public.measurement_orders%ROWTYPE;
  _ids uuid[];
  _tasks uuid[];
  _steps uuid[];
  _services uuid[];
  _snapshot jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Bitte erneut anmelden.' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('order_delete:' || _order_id::text, 0));
  SELECT * INTO _order FROM public.measurement_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auftrag nicht vorhanden oder bereits gelöscht.' USING ERRCODE='P0002'; END IF;
  IF NOT (public.has_role(_uid, 'master'::public.app_role) OR
      (_order.created_by = _uid AND public.has_role(_uid, 'auftraggeber'::public.app_role)))
      OR (public.is_external_customer(_uid) AND (_order.created_by <> _uid OR _order.order_type = 'internal')) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Löschen dieses Auftrags.' USING ERRCODE='42501';
  END IF;
  IF _order.order_type = 'internal' THEN
    RAISE EXCEPTION 'Interne Prüfaufträge bitte ausschließlich in der Prüfmittelüberwachung abbrechen.';
  END IF;
  IF public.is_order_locked(_order_id) THEN RAISE EXCEPTION 'Auftrag ist gesperrt und darf nicht gelöscht werden.'; END IF;
  IF _order.status::text <> 'open' THEN RAISE EXCEPTION 'Nur offene, vollständig unbearbeitete Aufträge dürfen gelöscht werden.'; END IF;
  PERFORM 1 FROM public.order_measurements WHERE order_id=_order_id ORDER BY id FOR UPDATE;
  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO _ids FROM public.order_measurements WHERE order_id=_order_id;
  PERFORM 1 FROM public.order_workflow_instances WHERE order_id=_order_id ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.order_workflow_tasks WHERE order_id=_order_id ORDER BY id FOR UPDATE;
  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO _tasks FROM public.order_workflow_tasks WHERE order_id=_order_id;
  PERFORM 1 FROM public.order_step_runs WHERE order_id=_order_id ORDER BY id FOR UPDATE;
  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO _steps FROM public.order_step_runs WHERE order_id=_order_id;
  PERFORM 1 FROM public.order_processes WHERE order_id=_order_id ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.order_process_services WHERE order_process_id IN (SELECT id FROM public.order_processes WHERE order_id=_order_id) ORDER BY id FOR UPDATE;
  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO _services FROM public.order_process_services WHERE order_process_id IN (SELECT id FROM public.order_processes WHERE order_id=_order_id);
  PERFORM 1 FROM public.order_service_forms WHERE order_process_service_id=ANY(_services) ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.order_step_positions WHERE step_run_id=ANY(_steps) ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.order_workflow_task_positions WHERE task_id=ANY(_tasks) ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.pilot_plant_blocks WHERE order_id=_order_id ORDER BY id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.order_measurements WHERE id=ANY(_ids) AND
      (status::text <> 'open' OR coalesce(actual_duration_hours,0)>0))
    OR EXISTS(SELECT 1 FROM public.order_workflow_tasks WHERE id=ANY(_tasks) AND
      (status NOT IN ('open','pending','planned','entwurf','geplant') OR opened_at IS NOT NULL OR completed_at IS NOT NULL OR time_entry_id IS NOT NULL OR coalesce(auto_time_minutes,0)>0 OR coalesce(form_response,'{}'::jsonb) <> '{}'::jsonb))
    OR EXISTS(SELECT 1 FROM public.order_step_runs WHERE id=ANY(_steps) AND
      (status::text NOT IN ('pending','open') OR opened_at IS NOT NULL OR completed_at IS NOT NULL OR time_entry_id IS NOT NULL OR coalesce(auto_time_minutes,0)>0 OR coalesce(form_response,'{}'::jsonb) <> '{}'::jsonb))
    OR EXISTS(SELECT 1 FROM public.order_processes WHERE order_id=_order_id AND
      (status NOT IN ('pending','open','planned','entwurf','geplant') OR started_at IS NOT NULL OR completed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM public.order_process_services WHERE id=ANY(_services) AND
      (status NOT IN ('pending','open','planned','entwurf','geplant') OR started_at IS NOT NULL OR completed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM public.order_service_forms WHERE order_process_service_id=ANY(_services) AND
      (status NOT IN ('pending','open','draft','entwurf') OR completed_at IS NOT NULL OR coalesce(response_data,'{}'::jsonb) <> '{}'::jsonb))
    OR EXISTS(SELECT 1 FROM public.pilot_plant_blocks WHERE order_id=_order_id AND
      (status::text <> 'pending' OR started_at IS NOT NULL OR completed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM public.order_step_positions WHERE step_run_id=ANY(_steps) AND
      (status::text <> 'open' OR result_value IS NOT NULL OR coalesce(result_data,'{}'::jsonb)<>'{}'::jsonb OR completed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM public.order_workflow_task_positions WHERE task_id=ANY(_tasks) AND
      (status::text <> 'open' OR result_value IS NOT NULL OR completed_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'Auftrag wurde bereits bearbeitet; begonnene oder abgeschlossene Aufgaben dürfen nicht gelöscht werden.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.measurement_results WHERE order_measurement_id=ANY(_ids))
    OR EXISTS(SELECT 1 FROM public.measurement_raw_datasets WHERE order_measurement_id=ANY(_ids))
    OR EXISTS(SELECT 1 FROM public.measurement_result_corrections WHERE order_measurement_id=ANY(_ids))
    OR EXISTS(SELECT 1 FROM public.measurement_import_operations WHERE order_measurement_id=ANY(_ids)) THEN
    RAISE EXCEPTION 'Auftrag enthält Messergebnisse, Rohdaten oder Korrekturen und darf nicht gelöscht werden.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.work_logs WHERE order_measurement_id=ANY(_ids))
    OR EXISTS(SELECT 1 FROM public.project_time_entries WHERE order_id=_order_id)
    OR EXISTS(SELECT 1 FROM public.project_knetung_materials WHERE order_measurement_id=ANY(_ids)) THEN
    RAISE EXCEPTION 'Auftrag enthält Arbeitszeiten oder Materialbuchungen und darf nicht gelöscht werden.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.documents WHERE order_measurement_id=ANY(_ids))
    OR EXISTS(SELECT 1 FROM public.order_upload_files WHERE measurement_id=ANY(_ids))
    OR EXISTS(SELECT 1 FROM public.order_reports WHERE order_id=_order_id)
    OR EXISTS(SELECT 1 FROM public.production_releases WHERE order_id=_order_id)
    OR EXISTS(SELECT 1 FROM public.production_document_requests WHERE order_id=_order_id) THEN
    RAISE EXCEPTION 'Auftrag enthält Dokumente, Berichte oder Fertigungsunterlagen und darf nicht gelöscht werden.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.pilot_plant_produced_samples WHERE order_id=_order_id)
    OR EXISTS(SELECT 1 FROM public.samples WHERE order_id=_order_id OR pilot_plant_order_id=_order_id OR prepared_for_measurement_id=ANY(_ids))
    OR EXISTS(SELECT 1 FROM public.order_measurements WHERE source_measurement_id=ANY(_ids) AND order_id<>_order_id) THEN
    RAISE EXCEPTION 'Auftrag hat erzeugte Proben oder Folgemessungen und darf nicht gelöscht werden.';
  END IF;
  SELECT jsonb_build_object('order',to_jsonb(_order),
    'measurements',coalesce((SELECT jsonb_agg(to_jsonb(m)) FROM public.order_measurements m WHERE id=ANY(_ids)),'[]'::jsonb),
    'parameters',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM public.measurement_parameters p WHERE order_measurement_id=ANY(_ids)),'[]'::jsonb),
    'order_audit',coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM public.order_audit_log a WHERE order_id=_order_id),'[]'::jsonb)) INTO _snapshot;
  UPDATE public.activity_log SET order_id=NULL, order_measurement_id=NULL,
    metadata=metadata || jsonb_build_object('deleted_order_id',_order_id,'deleted_order_number',_order.order_number,'deleted_measurement_id',order_measurement_id)
    WHERE order_id=_order_id OR order_measurement_id=ANY(_ids);
  INSERT INTO public.activity_log(event_type,actor_user_id,project_id,metadata)
    VALUES('order_deleted',_uid,_order.project_id,
      _snapshot || jsonb_build_object('deleted_order_id',_order_id,'order_number',_order.order_number,'deleted_at',now()));
  DELETE FROM public.measurement_orders WHERE id=_order_id;
  IF NOT FOUND OR EXISTS(SELECT 1 FROM public.order_measurements WHERE order_id=_order_id) THEN
    RAISE EXCEPTION 'Auftrag konnte nicht vollständig gelöscht werden. Es wurden keine Änderungen übernommen.';
  END IF;
  RETURN _order_id;
END $$;
REVOKE ALL ON FUNCTION public.cancel_or_delete_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_or_delete_order(uuid) TO authenticated;
REVOKE DELETE ON public.measurement_orders FROM authenticated, anon;