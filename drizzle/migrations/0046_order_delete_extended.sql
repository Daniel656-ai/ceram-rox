-- 0046: Aufträge löschen erweitern (Master und Ersteller) – nur echte Messdaten sperren das Löschen.
--
-- ============================================================================================
-- DATENBANK-/BERECHTIGUNGSÄNDERUNG – vor der Übertragung nach PRODUKTION ist die Freigabe durch
-- Stefan erforderlich. In der Dev-Datenbank wird sie normal über den Merge eingespielt.
-- ============================================================================================
-- Es ändert sich NICHT, wer löschen darf (Master und Ersteller, wie in 0036/0037) – nur, was das Löschen blockiert.
--
-- STÄRKER GESPERRT als bisher:
--   * Offizielle Berichte: ein Bericht mit Version > 0 (order_reports.current_version_no) sperrt das Löschen.
--     (Bisher wurden Berichte beim Löschen mit entfernt.)
-- NICHT MEHR GESPERRT:
--   * Vom Ersteller beim Anlegen vorbefüllte, nicht offizielle Formularwerte (measurement_results, result_name 'form:…',
--     höchstens 10 Minuten nach Anlage der Aufgabe, gleiche Regel wie in 0040). Sie werden mit dem Auftrag gelöscht
--     und im Löschprotokoll gesichert.
--   * Verknüpfung zu einem weiteren Prozessauftrag (order_instances.legacy_order_id): wird gelöst (NULL), der Prozessauftrag
--     bleibt bestehen (Trigger guard_order_delete_dependents).
--   * Für den Auftrag angelegte Proben, an denen sonst nichts hängt: werden mitgelöscht (order_sample_plan); alle übrigen
--     bleiben stehen (Bezug zum Auftrag wird gelöst) und werden im Dialog genannt.
-- WEITERHIN GESPERRT (unverändert streng): echte Messergebnisse, Rohdaten, Korrekturen/Korrekturhistorie, Importvorgänge,
--   Arbeitszeiten, Zeit- und Materialbuchungen, begonnene Aufgaben/Prozesse, nicht offene oder gesperrte Aufträge, interne
--   Prüfaufträge, Technikums-/Folgeproben.
-- Neu: _order_delete_blockers (EINE Stelle für alle Sperrgründe, von Löschfunktion und Dialog benutzt),
--   order_sample_plan, _cancel_or_delete_order_core (Kern, nur intern aufrufbar). cancel_or_delete_order bleibt die
--   öffentliche Funktion (gleiche Signatur). delete_m3_list ruft den Kern ohne Probenlöschung auf (verwaltet seine Proben selbst).
-- Mehrfach ausführbar (CREATE OR REPLACE).

-- 1) Nur ECHTE Messergebnisse zählen (vorbefüllte Formularwerte nicht).
CREATE OR REPLACE FUNCTION public.order_has_results(_order_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.measurement_results r
      JOIN public.order_measurements m ON m.id = r.order_measurement_id
      JOIN public.measurement_orders o ON o.id = m.order_id
     WHERE m.order_id = _order_id
       AND NOT (r.is_official IS NOT TRUE
                AND r.result_name LIKE 'form:%'
                AND o.created_by IS NOT NULL
                AND r.measured_by IS NOT DISTINCT FROM o.created_by
                AND r.created_at <= m.created_at + interval '10 minutes'));
$$;
REVOKE ALL ON FUNCTION public.order_has_results(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_has_results(uuid) TO authenticated;

-- 2) Welche für diesen Auftrag angelegten Proben dürfen mitgelöscht werden?
--    Kandidaten: Proben mit Bezug zu diesem Auftrag (samples.order_id) ODER aus der m³-Liste erzeugte Proben dieses Auftrags
--    (Beschreibung "Aus m³-Liste …"). Löschbar nur, wenn Status "neu" und nichts anderes daran hängt.
CREATE OR REPLACE FUNCTION public.order_sample_plan(_order_id uuid)
RETURNS TABLE(sample_id uuid, sample_name text, deletable boolean, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; _r text[];
BEGIN
  FOR s IN
    SELECT DISTINCT sa.id, sa.sample_name, sa.status::text AS status
    FROM public.samples sa
    WHERE sa.order_id = _order_id
       OR (sa.description LIKE 'Aus m³-Liste%'
           AND EXISTS (SELECT 1 FROM public.order_samples os WHERE os.order_id = _order_id AND os.sample_id = sa.id))
    ORDER BY sa.sample_name
  LOOP
    _r := ARRAY[]::text[];
    IF s.status <> 'neu' THEN _r := _r || 'Status nicht „neu“'::text; END IF;
    IF EXISTS(SELECT 1 FROM public.order_samples o2 WHERE o2.sample_id = s.id AND o2.order_id <> _order_id)
      OR EXISTS(SELECT 1 FROM public.measurement_orders mo WHERE mo.sample_id = s.id AND mo.id <> _order_id)
      THEN _r := _r || 'an einem weiteren Auftrag'::text; END IF;
    IF EXISTS(SELECT 1 FROM public.order_measurements m WHERE (m.sample_id = s.id OR m.original_sample_id = s.id) AND m.order_id <> _order_id)
      THEN _r := _r || 'an einer Messung eines anderen Auftrags'::text; END IF;
    IF EXISTS(SELECT 1 FROM public.measurement_raw_datasets d WHERE d.sample_id = s.id) THEN _r := _r || 'Rohdaten vorhanden'::text; END IF;
    IF EXISTS(SELECT 1 FROM public.order_step_positions p JOIN public.order_step_runs r ON r.id = p.step_run_id
               WHERE p.sample_id = s.id AND r.order_id <> _order_id)
      OR EXISTS(SELECT 1 FROM public.order_workflow_task_positions p JOIN public.order_workflow_tasks t ON t.id = p.task_id
               WHERE p.sample_id = s.id AND t.order_id <> _order_id)
      THEN _r := _r || 'an einer Aufgabenposition'::text; END IF;
    IF EXISTS(SELECT 1 FROM public.pilot_plant_produced_samples p WHERE p.created_sample_id = s.id)
      THEN _r := _r || 'Technikumsprobe'::text; END IF;
    IF EXISTS(SELECT 1 FROM public.sample_documents d WHERE d.sample_id = s.id) THEN _r := _r || 'Probendokumente vorhanden'::text; END IF;
    IF EXISTS(SELECT 1 FROM public.sample_geometry_datasets d WHERE d.sample_id = s.id) THEN _r := _r || 'Geometriedaten vorhanden'::text; END IF;
    IF EXISTS(SELECT 1 FROM public.sample_history h WHERE h.sample_id = s.id AND h.action <> 'created')
      THEN _r := _r || 'Probenhistorie (Status-/Lagerortwechsel)'::text; END IF;
    IF EXISTS(SELECT 1 FROM public.samples c WHERE c.parent_sample_id = s.id) THEN _r := _r || 'Unterproben vorhanden'::text; END IF;
    sample_id := s.id; sample_name := s.sample_name;
    deletable := cardinality(_r) = 0;
    reason := CASE WHEN cardinality(_r) = 0 THEN NULL ELSE array_to_string(_r, ', ') END;
    RETURN NEXT;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.order_sample_plan(uuid) FROM PUBLIC, anon, authenticated;

-- 3) EINE Stelle für alle Sperrgründe (Reihenfolge wie bisher; die Löschfunktion nennt den ersten, der Dialog alle).
CREATE OR REPLACE FUNCTION public._order_delete_blockers(_order_id uuid)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _order public.measurement_orders%ROWTYPE;
  _b text[] := ARRAY[]::text[];
  _ids uuid[];
  _tasks uuid[];
  _steps uuid[];
  _services uuid[];
BEGIN
  SELECT * INTO _order FROM public.measurement_orders WHERE id = _order_id;
  IF NOT FOUND THEN RETURN _b; END IF;
  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO _ids FROM public.order_measurements WHERE order_id=_order_id;
  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO _tasks FROM public.order_workflow_tasks WHERE order_id=_order_id;
  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO _steps FROM public.order_step_runs WHERE order_id=_order_id;
  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO _services FROM public.order_process_services WHERE order_process_id IN (SELECT id FROM public.order_processes WHERE order_id=_order_id);

  IF _order.order_type = 'internal' THEN
    _b := _b || 'Interne Prüfaufträge bitte ausschließlich in der Prüfmittelüberwachung abbrechen.'::text;
  END IF;
  IF public.order_has_results(_order_id) THEN
    _b := _b || 'Auftrag enthält Messergebnisse, Rohdaten oder Korrekturen und darf nicht gelöscht werden.'::text;
  END IF;
  IF public.is_order_locked(_order_id) THEN _b := _b || 'Auftrag ist gesperrt und darf nicht gelöscht werden.'::text; END IF;
  IF _order.status::text <> 'open' THEN _b := _b || 'Nur offene, vollständig unbearbeitete Aufträge dürfen gelöscht werden.'::text; END IF;
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
    _b := _b || 'Auftrag wurde bereits bearbeitet; begonnene oder abgeschlossene Aufgaben dürfen nicht gelöscht werden.'::text;
  END IF;
  IF EXISTS(SELECT 1 FROM public.measurement_raw_datasets WHERE order_measurement_id=ANY(_ids))
    OR EXISTS(SELECT 1 FROM public.measurement_result_corrections WHERE order_measurement_id=ANY(_ids) OR order_id=_order_id)
    OR EXISTS(SELECT 1 FROM public.measurement_import_operations WHERE order_measurement_id=ANY(_ids)) THEN
    _b := _b || 'Auftrag enthält Messergebnisse, Rohdaten oder Korrekturen und darf nicht gelöscht werden.'::text;
  END IF;
  IF EXISTS(SELECT 1 FROM public.work_logs WHERE order_measurement_id=ANY(_ids))
    OR EXISTS(SELECT 1 FROM public.project_time_entries WHERE order_id=_order_id)
    OR EXISTS(SELECT 1 FROM public.project_knetung_materials WHERE order_measurement_id=ANY(_ids)) THEN
    _b := _b || 'Auftrag enthält Arbeitszeiten oder Materialbuchungen und darf nicht gelöscht werden.'::text;
  END IF;
  IF EXISTS(SELECT 1 FROM public.order_reports WHERE order_id=_order_id AND coalesce(current_version_no,0) > 0) THEN
    _b := _b || 'Auftrag hat einen offiziellen Bericht und darf nicht gelöscht werden.'::text;
  END IF;
  IF EXISTS(SELECT 1 FROM public.pilot_plant_produced_samples WHERE order_id=_order_id)
    OR EXISTS(SELECT 1 FROM public.samples WHERE pilot_plant_order_id=_order_id OR prepared_for_measurement_id=ANY(_ids))
    OR EXISTS(SELECT 1 FROM public.order_measurements WHERE source_measurement_id=ANY(_ids) AND order_id<>_order_id) THEN
    _b := _b || 'Auftrag hat erzeugte Proben oder Folgemessungen und darf nicht gelöscht werden.'::text;
  END IF;
  RETURN _b;
END $$;
REVOKE ALL ON FUNCTION public._order_delete_blockers(uuid) FROM PUBLIC, anon, authenticated;

-- 4) Schutz-Trigger: die Verknüpfung zu einem weiteren Prozessauftrag wird GELÖST statt das Löschen zu blockieren.
--    Unverändert gesperrt bleibt der Auftrag mit Korrekturhistorie.
CREATE OR REPLACE FUNCTION public.guard_order_delete_dependents()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _instances uuid[]; _snapshot jsonb := '[]'::jsonb;
BEGIN
  PERFORM 1 FROM public.order_instances WHERE legacy_order_id=OLD.id ORDER BY id FOR UPDATE;
  SELECT coalesce(array_agg(id),ARRAY[]::uuid[]) INTO _instances FROM public.order_instances WHERE legacy_order_id=OLD.id;
  IF EXISTS(SELECT 1 FROM public.measurement_result_corrections WHERE order_id=OLD.id) THEN
    RAISE EXCEPTION 'Auftrag enthält Korrekturhistorie und darf nicht gelöscht werden.';
  END IF;
  IF cardinality(_instances)>0 THEN
    UPDATE public.order_instances SET legacy_order_id = NULL WHERE legacy_order_id = OLD.id;
    INSERT INTO public.activity_log(event_type,actor_user_id,project_id,metadata)
      VALUES('order_instances_unlinked',auth.uid(),OLD.project_id,
        jsonb_build_object('deleted_order_id',OLD.id,'order_number',OLD.order_number,'instance_ids',to_jsonb(_instances)));
  END IF;
  IF to_regclass('public.order_form_versions') IS NOT NULL THEN
    EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(v)),''[]''::jsonb) FROM public.order_form_versions v WHERE order_id=$1'
      INTO _snapshot USING OLD.id;
    IF jsonb_array_length(_snapshot)>0 THEN
      INSERT INTO public.activity_log(event_type,actor_user_id,project_id,metadata)
        VALUES('order_form_bindings_archived',auth.uid(),OLD.project_id,
          jsonb_build_object('deleted_order_id',OLD.id,'order_number',OLD.order_number,'form_versions',_snapshot));
      EXECUTE 'DELETE FROM public.order_form_versions WHERE order_id=$1' USING OLD.id;
    END IF;
  END IF;
  RETURN OLD;
END $$;

-- 5) Was hängt am Auftrag / was passiert beim Löschen? (Dialog)
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
    'measurements', (SELECT count(*) FROM public.order_measurements m WHERE m.order_id = _order_id),
    'process_links', (SELECT count(*) FROM public.order_instances i WHERE i.legacy_order_id = _order_id),
    'prefilled_values', (SELECT count(*) FROM public.measurement_results r JOIN public.order_measurements m ON m.id = r.order_measurement_id
        JOIN public.measurement_orders o ON o.id = m.order_id
        WHERE m.order_id = _order_id
          AND r.is_official IS NOT TRUE AND r.result_name LIKE 'form:%' AND o.created_by IS NOT NULL
          AND r.measured_by IS NOT DISTINCT FROM o.created_by AND r.created_at <= m.created_at + interval '10 minutes'),
    'audit_entries', (SELECT count(*) FROM public.order_audit_log a WHERE a.order_id = _order_id),
    'sample_plan', coalesce((SELECT jsonb_agg(jsonb_build_object('name', p.sample_name, 'deletable', p.deletable, 'reason', p.reason)
        ORDER BY p.sample_name) FROM public.order_sample_plan(_order_id) p), '[]'::jsonb)
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
    || jsonb_build_object('has_results', public.order_has_results(_order_id),
                          'blockers', to_jsonb(public._order_delete_blockers(_order_id)));
END $$;
REVOKE ALL ON FUNCTION public.order_delete_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_delete_summary(uuid) TO authenticated;

-- 6) Löschen: Kern (nur intern) + öffentliche Funktion mit unveränderter Signatur.
CREATE OR REPLACE FUNCTION public._cancel_or_delete_order_core(_order_id uuid, _delete_samples boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _order public.measurement_orders%ROWTYPE;
  _ids uuid[];
  _tasks uuid[];
  _steps uuid[];
  _services uuid[];
  _snapshot jsonb;
  _attach jsonb;
  _blockers text[];
  _del_ids uuid[] := ARRAY[]::uuid[];
  _del_names text[] := ARRAY[]::text[];
  _kept jsonb := '[]'::jsonb;
  _deleted_names text[] := ARRAY[]::text[];
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

  -- Alle Sperrgründe an einer Stelle (nach dem Sperren der Zeilen). Der erste wird gemeldet.
  _blockers := public._order_delete_blockers(_order_id);
  IF cardinality(_blockers) > 0 THEN RAISE EXCEPTION '%', _blockers[1]; END IF;

  -- Probenplan VOR dem Löschen (danach ist die Zuordnung weg).
  SELECT coalesce(array_agg(p.sample_id) FILTER (WHERE p.deletable), ARRAY[]::uuid[]),
         coalesce(array_agg(p.sample_name) FILTER (WHERE p.deletable), ARRAY[]::text[]),
         coalesce(jsonb_agg(jsonb_build_object('name', p.sample_name, 'reason', p.reason)) FILTER (WHERE NOT p.deletable), '[]'::jsonb)
    INTO _del_ids, _del_names, _kept
    FROM public.order_sample_plan(_order_id) p;

  SELECT jsonb_build_object('order',to_jsonb(_order),
    'measurements',coalesce((SELECT jsonb_agg(to_jsonb(m)) FROM public.order_measurements m WHERE id=ANY(_ids)),'[]'::jsonb),
    'parameters',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM public.measurement_parameters p WHERE order_measurement_id=ANY(_ids)),'[]'::jsonb),
    'prefilled_values',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM public.measurement_results r WHERE order_measurement_id=ANY(_ids)),'[]'::jsonb),
    'order_audit',coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM public.order_audit_log a WHERE order_id=_order_id),'[]'::jsonb)) INTO _snapshot;
  UPDATE public.activity_log SET order_id=NULL, order_measurement_id=NULL,
    metadata=metadata || jsonb_build_object('deleted_order_id',_order_id,'deleted_order_number',_order.order_number,'deleted_measurement_id',order_measurement_id)
    WHERE order_id=_order_id OR order_measurement_id=ANY(_ids);
  INSERT INTO public.activity_log(event_type,actor_user_id,project_id,metadata)
    VALUES('order_deleted',_uid,_order.project_id,
      _snapshot || jsonb_build_object('deleted_order_id',_order_id,'order_number',_order.order_number,'deleted_at',now()));
  -- Anhänge (Dateien, Fertigungsunterlagen, m³-Anfragen, Verknüpfungen) werden mit dem Auftrag entfernt bzw. gelöst
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
  DELETE FROM public.order_samples WHERE order_id=_order_id;
  -- Proben, die stehen bleiben: Bezug zu diesem Auftrag lösen (sonst blockiert der Verweis das Löschen).
  UPDATE public.samples SET order_id = NULL WHERE order_id = _order_id;
  DELETE FROM public.measurement_orders WHERE id=_order_id;   -- Trigger löst Prozessverknüpfungen
  IF NOT FOUND OR EXISTS(SELECT 1 FROM public.order_measurements WHERE order_id=_order_id) THEN
    RAISE EXCEPTION 'Auftrag konnte nicht vollständig gelöscht werden. Es wurden keine Änderungen übernommen.';
  END IF;

  -- Mitzulöschende Proben: erneute Prüfung direkt vor dem Löschen (Zuordnung zu diesem Auftrag ist jetzt weg).
  IF _delete_samples THEN
    WITH del AS (
      DELETE FROM public.samples s
      WHERE s.id = ANY(_del_ids)
        AND NOT EXISTS (SELECT 1 FROM public.order_samples o2 WHERE o2.sample_id = s.id)
        AND NOT EXISTS (SELECT 1 FROM public.measurement_orders mo WHERE mo.sample_id = s.id)
        AND NOT EXISTS (SELECT 1 FROM public.order_measurements m WHERE m.sample_id = s.id OR m.original_sample_id = s.id)
        AND NOT EXISTS (SELECT 1 FROM public.measurement_raw_datasets d WHERE d.sample_id = s.id)
        AND NOT EXISTS (SELECT 1 FROM public.order_step_positions p WHERE p.sample_id = s.id)
        AND NOT EXISTS (SELECT 1 FROM public.order_workflow_task_positions p WHERE p.sample_id = s.id)
        AND NOT EXISTS (SELECT 1 FROM public.pilot_plant_produced_samples p WHERE p.created_sample_id = s.id)
        AND NOT EXISTS (SELECT 1 FROM public.sample_documents d WHERE d.sample_id = s.id)
        AND NOT EXISTS (SELECT 1 FROM public.sample_geometry_datasets d WHERE d.sample_id = s.id)
        AND NOT EXISTS (SELECT 1 FROM public.sample_history h WHERE h.sample_id = s.id AND h.action <> 'created')
        AND NOT EXISTS (SELECT 1 FROM public.samples c WHERE c.parent_sample_id = s.id)
      RETURNING s.sample_name
    )
    SELECT coalesce(array_agg(sample_name), ARRAY[]::text[]) INTO _deleted_names FROM del;
    UPDATE public.activity_log SET metadata = metadata || jsonb_build_object('deleted_sample_names', _deleted_names, 'kept_samples', _kept)
      WHERE event_type='order_deleted' AND metadata->>'deleted_order_id' = _order_id::text;
  END IF;
  RETURN jsonb_build_object('order_id', _order_id, 'deleted_samples', to_jsonb(_deleted_names), 'kept_samples', _kept);
END $$;
REVOKE ALL ON FUNCTION public._cancel_or_delete_order_core(uuid, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cancel_or_delete_order(_order_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._cancel_or_delete_order_core(_order_id, true);
  RETURN _order_id;
END $$;
REVOKE ALL ON FUNCTION public.cancel_or_delete_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_or_delete_order(uuid) TO authenticated;

-- 7) m³-Liste löschen: gleiche Logik wie 0038, ruft aber den Kern OHNE Probenlöschung (die m³-Liste verwaltet ihre Proben selbst).
CREATE OR REPLACE FUNCTION public.delete_m3_list(_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _q public.production_document_requests%ROWTYPE;
  _order_number text;
  _ids uuid[] := ARRAY[]::uuid[];
  _names text[] := ARRAY[]::text[];
  _deleted_names text[] := ARRAY[]::text[];
  _kept jsonb := '[]'::jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Bitte erneut anmelden.' USING ERRCODE='42501'; END IF;
  SELECT * INTO _q FROM public.production_document_requests WHERE id = _request_id AND doc_kind = 'm3_list' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'm³-Liste nicht vorhanden oder bereits gelöscht.' USING ERRCODE='P0002'; END IF;
  IF NOT (public.has_role(_uid, 'master'::public.app_role) OR _q.requested_by = _uid) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Löschen dieser m³-Liste.' USING ERRCODE='42501';
  END IF;

  IF _q.order_id IS NULL THEN
    DELETE FROM public.production_document_requests WHERE id = _request_id;
    INSERT INTO public.activity_log(event_type, actor_user_id, metadata)
      VALUES('m3_list_deleted', _uid, jsonb_build_object('request_id', _request_id, 'based_on_release_id', _q.based_on_release_id, 'order_deleted', false));
    RETURN jsonb_build_object('order_deleted', false, 'deleted_samples', '[]'::jsonb, 'kept_samples', '[]'::jsonb);
  END IF;

  SELECT order_number INTO _order_number FROM public.measurement_orders WHERE id = _q.order_id;
  SELECT coalesce(array_agg(p.sample_id) FILTER (WHERE p.deletable), ARRAY[]::uuid[]),
         coalesce(array_agg(p.sample_name) FILTER (WHERE p.deletable), ARRAY[]::text[]),
         coalesce(jsonb_agg(jsonb_build_object('name', p.sample_name, 'reason', p.reason)) FILTER (WHERE NOT p.deletable), '[]'::jsonb)
    INTO _ids, _names, _kept
    FROM public.m3_list_sample_plan(_q.order_id) p;

  -- Wirft bei Ergebnissen, Sperren, Rechten usw.; löscht Auftrag, Anhänge, m³-Liste und Probenzuordnungen (Proben: s. u.).
  PERFORM public._cancel_or_delete_order_core(_q.order_id, false);

  WITH del AS (
    DELETE FROM public.samples s
    WHERE s.id = ANY(_ids)
      AND NOT EXISTS (SELECT 1 FROM public.order_samples o2 WHERE o2.sample_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.measurement_orders mo WHERE mo.sample_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.order_measurements m WHERE m.sample_id = s.id OR m.original_sample_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.measurement_raw_datasets d WHERE d.sample_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.order_step_positions p WHERE p.sample_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.order_workflow_task_positions p WHERE p.sample_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.pilot_plant_produced_samples p WHERE p.created_sample_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.sample_documents d WHERE d.sample_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.sample_geometry_datasets d WHERE d.sample_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.sample_history h WHERE h.sample_id = s.id AND h.action <> 'created')
      AND NOT EXISTS (SELECT 1 FROM public.samples c WHERE c.parent_sample_id = s.id)
    RETURNING s.sample_name
  )
  SELECT coalesce(array_agg(sample_name), ARRAY[]::text[]) INTO _deleted_names FROM del;

  INSERT INTO public.activity_log(event_type, actor_user_id, metadata)
    VALUES('m3_list_deleted', _uid, jsonb_build_object(
      'request_id', _request_id, 'based_on_release_id', _q.based_on_release_id,
      'order_deleted', true, 'deleted_order_id', _q.order_id, 'order_number', _order_number,
      'deleted_sample_names', _deleted_names, 'planned_sample_names', _names, 'kept_samples', _kept));

  RETURN jsonb_build_object('order_deleted', true, 'order_number', _order_number,
    'deleted_samples', to_jsonb(_deleted_names), 'kept_samples', _kept);
END $$;
REVOKE ALL ON FUNCTION public.delete_m3_list(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_m3_list(uuid) TO authenticated;
