-- Aufträge mit angehängten Dateien löschen (nur Ersteller bzw. Master, wie bisher).
-- 1) order_delete_attachments: internes Verzeichnis, was am Auftrag hängt (kein Rechtecheck, nicht für Clients).
-- 2) order_delete_summary: dasselbe für die Oberfläche (Hinweis vor dem Löschen), mit Rechteprüfung.
-- 3) cancel_or_delete_order: wie 0036, aber Dateien/Berichte/Fertigungsunterlagen blockieren nicht mehr.
--    Weiter gesperrt: Messergebnisse, Rohdaten, Korrekturen, Arbeitszeiten, Materialbuchungen,
--    begonnene Aufgaben, erzeugte Proben/Folgemessungen, gesperrte oder nicht offene Aufträge.
CREATE OR REPLACE FUNCTION public.order_delete_attachments(_order_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'documents', coalesce((SELECT jsonb_agg(d.file_name ORDER BY d.file_name) FROM public.documents d
        JOIN public.order_measurements m ON m.id = d.order_measurement_id WHERE m.order_id = _order_id), '[]'::jsonb),
    'upload_files', coalesce((SELECT jsonb_agg(u.file_name ORDER BY u.file_name) FROM public.order_upload_files u
        JOIN public.order_measurements m ON m.id = u.measurement_id WHERE m.order_id = _order_id), '[]'::jsonb),
    'reports', (SELECT count(*) FROM public.order_reports r WHERE r.order_id = _order_id),
    'production_releases', coalesce((SELECT jsonb_agg(p.release_number ORDER BY p.release_number) FROM public.production_releases p
        WHERE p.order_id = _order_id), '[]'::jsonb),
    'm3_requests', (SELECT count(*) FROM public.production_document_requests q WHERE q.order_id = _order_id),
    'samples', (SELECT count(*) FROM public.order_samples s WHERE s.order_id = _order_id),
    'measurements', (SELECT count(*) FROM public.order_measurements m WHERE m.order_id = _order_id)
  );
$$;
REVOKE ALL ON FUNCTION public.order_delete_attachments(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.order_delete_summary(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _created_by uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Bitte erneut anmelden.' USING ERRCODE='42501'; END IF;
  SELECT created_by INTO _created_by FROM public.measurement_orders WHERE id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auftrag nicht vorhanden.' USING ERRCODE='P0002'; END IF;
  IF NOT (public.has_role(_uid, 'master'::public.app_role) OR _created_by = _uid) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diesen Auftrag.' USING ERRCODE='42501';
  END IF;
  RETURN public.order_delete_attachments(_order_id)
    || jsonb_build_object('has_results', public.order_has_results(_order_id));
END $$;
REVOKE ALL ON FUNCTION public.order_delete_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_delete_summary(uuid) TO authenticated;

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
  _attach jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Bitte erneut anmelden.' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('order_delete:' || _order_id::text, 0));
  SELECT * INTO _order FROM public.measurement_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auftrag nicht vorhanden oder bereits gelöscht.' USING ERRCODE='P0002'; END IF;
  IF NOT (public.has_role(_uid, 'master'::public.app_role) OR
      _order.created_by = _uid)
      OR (public.is_external_customer(_uid) AND (_order.created_by <> _uid OR _order.order_type = 'internal')) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Löschen dieses Auftrags.' USING ERRCODE='42501';
  END IF;
  IF _order.order_type = 'internal' THEN
    RAISE EXCEPTION 'Interne Prüfaufträge bitte ausschließlich in der Prüfmittelüberwachung abbrechen.';
  END IF;
  IF public.order_has_results(_order_id) THEN RAISE EXCEPTION 'Auftrag enthält Messergebnisse, Rohdaten oder Korrekturen und darf nicht gelöscht werden.'; END IF;
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
  -- Anhänge (Dateien, Berichte, Fertigungsunterlagen) werden mit dem Auftrag entfernt bzw. gelöst
  -- und im Löschprotokoll festgehalten. Dateien aus dokumentierten Korrekturen bleiben durch
  -- rox_guard_versioned_file_delete geschützt (dann bricht das Löschen ab).
  _attach := public.order_delete_attachments(_order_id);
  UPDATE public.activity_log SET metadata = metadata || jsonb_build_object('removed_attachments', _attach)
    WHERE event_type='order_deleted' AND metadata->>'deleted_order_id' = _order_id::text;
  DELETE FROM public.documents WHERE order_measurement_id=ANY(_ids);
  DELETE FROM public.order_upload_files WHERE measurement_id=ANY(_ids);
  DELETE FROM public.order_reports WHERE order_id=_order_id;
  UPDATE public.production_releases SET order_id=NULL WHERE order_id=_order_id;
  DELETE FROM public.production_document_requests WHERE order_id=_order_id;
  DELETE FROM public.measurement_orders WHERE id=_order_id;
  IF NOT FOUND OR EXISTS(SELECT 1 FROM public.order_measurements WHERE order_id=_order_id) THEN
    RAISE EXCEPTION 'Auftrag konnte nicht vollständig gelöscht werden. Es wurden keine Änderungen übernommen.';
  END IF;
  RETURN _order_id;
END $$;
REVOKE ALL ON FUNCTION public.cancel_or_delete_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_or_delete_order(uuid) TO authenticated;
