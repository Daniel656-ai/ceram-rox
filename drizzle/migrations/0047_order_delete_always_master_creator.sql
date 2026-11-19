-- 0047: Aufträge löschen – Master und Ersteller dürfen IMMER löschen (auch mit Messdaten).
--
-- ============================================================================================
-- DATENBANK-/BERECHTIGUNGSÄNDERUNG – vor der Übertragung nach PRODUKTION ist die Freigabe durch
-- Stefan erforderlich. In der Dev-Datenbank wird sie normal über den Merge eingespielt.
-- ============================================================================================
-- Wer löschen darf, ändert sich NICHT (Master und Ersteller, alle anderen weiterhin nicht).
-- Neu gegenüber 0046:
--   * Nichts blockiert das Löschen mehr: echte Messergebnisse, Rohdaten, Korrekturen/Korrekturhistorie, Importvorgänge,
--     Arbeitszeiten, Zeit-/Materialbuchungen, offizielle Berichte, begonnene/abgeschlossene Aufgaben und Prozesse,
--     abgeschlossene (gesperrte) Aufträge sowie erzeugte Proben/Folgemessungen.
--     AUSNAHME (unverändert): Interne Prüfaufträge (Prüfmittelüberwachung) – sie haben eigene, unveränderliche Prüfhistorie
--     und werden nur dort abgebrochen.
--   * Bei Aufträgen mit Messdaten muss die Auftragsnummer (technische Nummer oder Versuchsnummer) zur Bestätigung
--     mitgegeben werden (_confirm_number). Die Prüfung erfolgt hier in der Datenbank, nicht nur in der Oberfläche.
--   * Sicherungskopie: ALLE gelöschten Daten des Auftrags (Messungen, Ergebnisse, Rohdaten samt Kurven, Korrekturen,
--     Importvorgänge, Arbeitszeiten, Materialbuchungen, Berichte, Aufgaben/Positionen, Prozesse, Dateien-Metadaten,
--     Änderungsprotokoll) stehen im Löschprotokoll (activity_log, event_type 'order_deleted', metadata).
--     Dateien selbst (Storage) werden – wie bisher – von der Anwendung entfernt; im Protokoll steht ihre Metadaten-Zeile.
--   * Fertigungsfreigaben und m³-Listen bleiben bestehen, nur die Verknüpfung wird gelöst; Proben wie in 0046
--     (nur mitlöschen, wenn sie sonst nirgends hängen).
-- Technik: Die Löschfunktion setzt TRANSAKTIONSLOKAL die Schalter app.bypass_order_lock und app.order_force_delete
--   (nur nach erfolgreicher Rechteprüfung, wie bei den Korrekturfunktionen 0022/0023); danach werden sie zurückgesetzt.
-- Mehrfach ausführbar (CREATE OR REPLACE / DROP IF EXISTS).

-- 1) Sperrgründe: nur noch interne Prüfaufträge.
CREATE OR REPLACE FUNCTION public._order_delete_blockers(_order_id uuid)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _b text[] := ARRAY[]::text[];
BEGIN
  IF EXISTS(SELECT 1 FROM public.measurement_orders WHERE id = _order_id AND order_type = 'internal') THEN
    _b := _b || 'Interne Prüfaufträge bitte ausschließlich in der Prüfmittelüberwachung abbrechen.'::text;
  END IF;
  RETURN _b;
END $$;
REVOKE ALL ON FUNCTION public._order_delete_blockers(uuid) FROM PUBLIC, anon, authenticated;

-- 2) Hilfsfunktionen: Wurde am Auftrag schon gearbeitet? Gibt es Messdaten? Welche Nummern gelten als Bestätigung?
CREATE OR REPLACE FUNCTION public._order_started(_order_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    EXISTS(SELECT 1 FROM public.order_measurements WHERE order_id=_order_id AND
      (status::text <> 'open' OR coalesce(actual_duration_hours,0)>0))
    OR EXISTS(SELECT 1 FROM public.order_workflow_tasks WHERE order_id=_order_id AND
      (status NOT IN ('open','pending','planned','entwurf','geplant') OR opened_at IS NOT NULL OR completed_at IS NOT NULL OR time_entry_id IS NOT NULL OR coalesce(auto_time_minutes,0)>0 OR coalesce(form_response,'{}'::jsonb) <> '{}'::jsonb))
    OR EXISTS(SELECT 1 FROM public.order_step_runs WHERE order_id=_order_id AND
      (status::text NOT IN ('pending','open') OR opened_at IS NOT NULL OR completed_at IS NOT NULL OR time_entry_id IS NOT NULL OR coalesce(auto_time_minutes,0)>0 OR coalesce(form_response,'{}'::jsonb) <> '{}'::jsonb))
    OR EXISTS(SELECT 1 FROM public.order_processes WHERE order_id=_order_id AND
      (status NOT IN ('pending','open','planned','entwurf','geplant') OR started_at IS NOT NULL OR completed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM public.order_process_services s JOIN public.order_processes p ON p.id = s.order_process_id
      WHERE p.order_id=_order_id AND
      (s.status NOT IN ('pending','open','planned','entwurf','geplant') OR s.started_at IS NOT NULL OR s.completed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM public.order_service_forms f
      JOIN public.order_process_services s ON s.id = f.order_process_service_id
      JOIN public.order_processes p ON p.id = s.order_process_id
      WHERE p.order_id=_order_id AND
      (f.status NOT IN ('pending','open','draft','entwurf') OR f.completed_at IS NOT NULL OR coalesce(f.response_data,'{}'::jsonb) <> '{}'::jsonb))
    OR EXISTS(SELECT 1 FROM public.pilot_plant_blocks WHERE order_id=_order_id AND
      (status::text <> 'pending' OR started_at IS NOT NULL OR completed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM public.order_step_positions pos JOIN public.order_step_runs r ON r.id = pos.step_run_id
      WHERE r.order_id=_order_id AND
      (pos.status::text <> 'open' OR pos.result_value IS NOT NULL OR coalesce(pos.result_data,'{}'::jsonb)<>'{}'::jsonb OR pos.completed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM public.order_workflow_task_positions pos JOIN public.order_workflow_tasks t ON t.id = pos.task_id
      WHERE t.order_id=_order_id AND
      (pos.status::text <> 'open' OR pos.result_value IS NOT NULL OR pos.completed_at IS NOT NULL));
$$;
REVOKE ALL ON FUNCTION public._order_started(uuid) FROM PUBLIC, anon, authenticated;

-- Zählt, was am Auftrag an echten Messdaten hängt (vorbefüllte Formularwerte vom Anlegen zählen nicht).
CREATE OR REPLACE FUNCTION public._order_data_counts(_order_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'real_results', (SELECT count(*) FROM public.measurement_results r
        JOIN public.order_measurements m ON m.id = r.order_measurement_id
        JOIN public.measurement_orders o ON o.id = m.order_id
        WHERE m.order_id = _order_id
          AND NOT (r.is_official IS NOT TRUE AND r.result_name LIKE 'form:%' AND o.created_by IS NOT NULL
                   AND r.measured_by IS NOT DISTINCT FROM o.created_by AND r.created_at <= m.created_at + interval '10 minutes')),
    'raw_datasets', (SELECT count(*) FROM public.measurement_raw_datasets d JOIN public.order_measurements m ON m.id = d.order_measurement_id WHERE m.order_id = _order_id),
    'corrections', (SELECT count(*) FROM public.measurement_result_corrections c
        WHERE c.order_id = _order_id OR c.order_measurement_id IN (SELECT id FROM public.order_measurements WHERE order_id = _order_id)),
    'import_operations', (SELECT count(*) FROM public.measurement_import_operations i JOIN public.order_measurements m ON m.id = i.order_measurement_id WHERE m.order_id = _order_id),
    'work_logs', (SELECT count(*) FROM public.work_logs w JOIN public.order_measurements m ON m.id = w.order_measurement_id WHERE m.order_id = _order_id),
    'time_entries', (SELECT count(*) FROM public.project_time_entries t WHERE t.order_id = _order_id),
    'material_bookings', (SELECT count(*) FROM public.project_knetung_materials k JOIN public.order_measurements m ON m.id = k.order_measurement_id WHERE m.order_id = _order_id),
    'official_reports', (SELECT count(*) FROM public.order_reports r WHERE r.order_id = _order_id AND coalesce(r.current_version_no,0) > 0),
    'started', public._order_started(_order_id)
  );
$$;
REVOKE ALL ON FUNCTION public._order_data_counts(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._order_has_measurement_data(_order_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (c->>'started')::boolean
      OR (c->>'real_results')::int + (c->>'raw_datasets')::int + (c->>'corrections')::int + (c->>'import_operations')::int
       + (c->>'work_logs')::int + (c->>'time_entries')::int + (c->>'material_bookings')::int + (c->>'official_reports')::int > 0
  FROM (SELECT public._order_data_counts(_order_id) AS c) s;
$$;
REVOKE ALL ON FUNCTION public._order_has_measurement_data(uuid) FROM PUBLIC, anon, authenticated;

-- Nummern, mit denen das Löschen bestätigt werden kann: technische Auftragsnummer und Versuchsnummer (Technikum).
CREATE OR REPLACE FUNCTION public._order_confirm_numbers(_order_id uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(DISTINCT n), ARRAY[]::text[]) FROM (
    SELECT NULLIF(btrim(o.order_number), '') AS n FROM public.measurement_orders o WHERE o.id = _order_id
    UNION ALL SELECT NULLIF(btrim(o.pp_experiment_number), '') FROM public.measurement_orders o WHERE o.id = _order_id
    UNION ALL SELECT NULLIF(btrim(o.shared_form_data #>> '{pp,stammdaten,versuchsnummer}'), '') FROM public.measurement_orders o WHERE o.id = _order_id
    UNION ALL SELECT NULLIF(btrim(o.shared_form_data #>> '{template,values,versuchsnummer}'), '') FROM public.measurement_orders o WHERE o.id = _order_id
  ) s WHERE n IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public._order_confirm_numbers(uuid) FROM PUBLIC, anon, authenticated;

-- 3) Dateien versionierter Korrekturen dürfen beim bewussten Löschen des ganzen Auftrags mit entfernt werden.
CREATE OR REPLACE FUNCTION public.rox_guard_versioned_file_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF coalesce(current_setting('app.order_force_delete', true), '') = 'on' THEN RETURN OLD; END IF;
  IF public.rox_is_versioned_file(CASE TG_TABLE_NAME WHEN 'documents' THEN 'document' ELSE 'upload' END, OLD.id) THEN
    RAISE EXCEPTION 'Datei ist Teil einer dokumentierten Korrektur und darf nicht geloescht werden'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN OLD;
END $$;

-- 4) Schutz-Trigger: Korrekturhistorie blockiert nicht mehr (sie ist in der Sicherungskopie des Löschprotokolls).
CREATE OR REPLACE FUNCTION public.guard_order_delete_dependents()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _instances uuid[]; _snapshot jsonb := '[]'::jsonb;
BEGIN
  PERFORM 1 FROM public.order_instances WHERE legacy_order_id=OLD.id ORDER BY id FOR UPDATE;
  SELECT coalesce(array_agg(id),ARRAY[]::uuid[]) INTO _instances FROM public.order_instances WHERE legacy_order_id=OLD.id;
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

-- 5) Dialog: Was hängt am Auftrag / was passiert beim Löschen?
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
  ) || public._order_data_counts(_order_id);
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
                          'blockers', to_jsonb(public._order_delete_blockers(_order_id)),
                          'needs_confirmation', public._order_has_measurement_data(_order_id),
                          'confirm_numbers', to_jsonb(public._order_confirm_numbers(_order_id)));
END $$;
REVOKE ALL ON FUNCTION public.order_delete_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_delete_summary(uuid) TO authenticated;

-- 6) Löschen: Kern (nur intern) + öffentliche Funktion. Neue Signatur mit Bestätigungsnummer.
DROP FUNCTION IF EXISTS public.cancel_or_delete_order(uuid);
DROP FUNCTION IF EXISTS public._cancel_or_delete_order_core(uuid, boolean);
DROP FUNCTION IF EXISTS public._cancel_or_delete_order_core(uuid, boolean, text);

CREATE OR REPLACE FUNCTION public._cancel_or_delete_order_core(_order_id uuid, _delete_samples boolean, _confirm_number text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _order public.measurement_orders%ROWTYPE;
  _ids uuid[];
  _tasks uuid[];
  _steps uuid[];
  _services uuid[];
  _datasets uuid[];
  _snapshot jsonb;
  _attach jsonb;
  _blockers text[];
  _del_ids uuid[] := ARRAY[]::uuid[];
  _del_names text[] := ARRAY[]::text[];
  _kept jsonb := '[]'::jsonb;
  _deleted_names text[] := ARRAY[]::text[];
  _had_data boolean;
  _prior_bypass text;
  _prior_force text;
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

  -- Ab hier ist der Aufrufer berechtigt: Schreibschutz (abgeschlossener Auftrag) und Korrektur-Dateischutz
  -- gelten für diese Transaktion nicht. Beides wird am Ende zurückgesetzt (set_config ... is_local = true).
  _prior_bypass := current_setting('app.bypass_order_lock', true);
  _prior_force := current_setting('app.order_force_delete', true);
  PERFORM set_config('app.bypass_order_lock', 'on', true);
  PERFORM set_config('app.order_force_delete', 'on', true);

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
  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO _datasets FROM public.measurement_raw_datasets WHERE order_measurement_id=ANY(_ids);

  -- Einziger Sperrgrund: interne Prüfaufträge (eigene Prüfhistorie).
  _blockers := public._order_delete_blockers(_order_id);
  IF cardinality(_blockers) > 0 THEN RAISE EXCEPTION '%', _blockers[1]; END IF;

  -- Bei Messdaten: Auftragsnummer zur Bestätigung (Prüfung in der Datenbank).
  _had_data := public._order_has_measurement_data(_order_id);
  IF _had_data AND NOT (lower(btrim(coalesce(_confirm_number, ''))) = ANY(SELECT lower(x) FROM unnest(public._order_confirm_numbers(_order_id)) x)) THEN
    RAISE EXCEPTION 'Dieser Auftrag enthält Messdaten. Zum Löschen bitte die Auftragsnummer zur Bestätigung eingeben.' USING ERRCODE='22023';
  END IF;

  -- Probenplan VOR dem Löschen (danach ist die Zuordnung weg).
  SELECT coalesce(array_agg(p.sample_id) FILTER (WHERE p.deletable), ARRAY[]::uuid[]),
         coalesce(array_agg(p.sample_name) FILTER (WHERE p.deletable), ARRAY[]::text[]),
         coalesce(jsonb_agg(jsonb_build_object('name', p.sample_name, 'reason', p.reason)) FILTER (WHERE NOT p.deletable), '[]'::jsonb)
    INTO _del_ids, _del_names, _kept
    FROM public.order_sample_plan(_order_id) p;

  -- Sicherungskopie ALLER Daten, die mit dem Auftrag verschwinden (für die Wiederherstellung im Notfall).
  SELECT jsonb_build_object('order',to_jsonb(_order),
    'measurements',coalesce((SELECT jsonb_agg(to_jsonb(m)) FROM public.order_measurements m WHERE id=ANY(_ids)),'[]'::jsonb),
    'parameters',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM public.measurement_parameters p WHERE order_measurement_id=ANY(_ids)),'[]'::jsonb),
    'prefilled_values',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM public.measurement_results r WHERE order_measurement_id=ANY(_ids)),'[]'::jsonb),
    'raw_datasets',coalesce((SELECT jsonb_agg(to_jsonb(d)) FROM public.measurement_raw_datasets d WHERE id=ANY(_datasets)),'[]'::jsonb),
    'raw_series',coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM public.measurement_raw_series s WHERE dataset_id=ANY(_datasets)),'[]'::jsonb),
    'curve_evaluations',coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM public.measurement_curve_evaluations e WHERE dataset_id=ANY(_datasets)),'[]'::jsonb),
    'result_corrections',coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM public.measurement_result_corrections c WHERE order_measurement_id=ANY(_ids) OR order_id=_order_id),'[]'::jsonb),
    'import_operations',coalesce((SELECT jsonb_agg(to_jsonb(i)) FROM public.measurement_import_operations i WHERE order_measurement_id=ANY(_ids)),'[]'::jsonb),
    'work_logs',coalesce((SELECT jsonb_agg(to_jsonb(w)) FROM public.work_logs w WHERE order_measurement_id=ANY(_ids)),'[]'::jsonb),
    'time_entries',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.project_time_entries t WHERE order_id=_order_id),'[]'::jsonb),
    'material_bookings',coalesce((SELECT jsonb_agg(to_jsonb(k)) FROM public.project_knetung_materials k WHERE order_measurement_id=ANY(_ids)),'[]'::jsonb),
    'reports',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM public.order_reports r WHERE order_id=_order_id),'[]'::jsonb),
    'workflow_tasks',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.order_workflow_tasks t WHERE id=ANY(_tasks)),'[]'::jsonb),
    'workflow_task_positions',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM public.order_workflow_task_positions p WHERE task_id=ANY(_tasks)),'[]'::jsonb),
    'step_runs',coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM public.order_step_runs s WHERE id=ANY(_steps)),'[]'::jsonb),
    'step_positions',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM public.order_step_positions p WHERE step_run_id=ANY(_steps)),'[]'::jsonb),
    'processes',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM public.order_processes p WHERE order_id=_order_id),'[]'::jsonb),
    'process_services',coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM public.order_process_services s WHERE id=ANY(_services)),'[]'::jsonb),
    'service_forms',coalesce((SELECT jsonb_agg(to_jsonb(f)) FROM public.order_service_forms f WHERE order_process_service_id=ANY(_services)),'[]'::jsonb),
    'pilot_plant_blocks',coalesce((SELECT jsonb_agg(to_jsonb(b)) FROM public.pilot_plant_blocks b WHERE order_id=_order_id),'[]'::jsonb),
    'pilot_plant_produced_samples',coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM public.pilot_plant_produced_samples s WHERE order_id=_order_id),'[]'::jsonb),
    'order_samples',coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM public.order_samples s WHERE order_id=_order_id),'[]'::jsonb),
    'm3_requests',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM public.production_document_requests q WHERE order_id=_order_id),'[]'::jsonb),
    'documents',coalesce((SELECT jsonb_agg(to_jsonb(d)) FROM public.documents d WHERE order_measurement_id=ANY(_ids)),'[]'::jsonb),
    'upload_files',coalesce((SELECT jsonb_agg(to_jsonb(u)) FROM public.order_upload_files u WHERE measurement_id=ANY(_ids)),'[]'::jsonb),
    'order_audit',coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM public.order_audit_log a WHERE order_id=_order_id),'[]'::jsonb)) INTO _snapshot;
  UPDATE public.activity_log SET order_id=NULL, order_measurement_id=NULL,
    metadata=metadata || jsonb_build_object('deleted_order_id',_order_id,'deleted_order_number',_order.order_number,'deleted_measurement_id',order_measurement_id)
    WHERE order_id=_order_id OR order_measurement_id=ANY(_ids);
  INSERT INTO public.activity_log(event_type,actor_user_id,project_id,metadata)
    VALUES('order_deleted',_uid,_order.project_id,
      _snapshot || jsonb_build_object('deleted_order_id',_order_id,'order_number',_order.order_number,'deleted_at',now(),
                                      'had_measurement_data',_had_data,'confirmed_with',nullif(btrim(coalesce(_confirm_number,'')),''),
                                      'data_counts',public._order_data_counts(_order_id)));
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
  DELETE FROM public.measurement_orders WHERE id=_order_id;   -- Datenbank löscht Messungen, Ergebnisse, Rohdaten, Korrekturen, Aufgaben mit; Trigger löst Prozessverknüpfungen
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

  PERFORM set_config('app.bypass_order_lock', coalesce(nullif(_prior_bypass, ''), 'off'), true);
  PERFORM set_config('app.order_force_delete', coalesce(nullif(_prior_force, ''), 'off'), true);
  RETURN jsonb_build_object('order_id', _order_id, 'deleted_samples', to_jsonb(_deleted_names), 'kept_samples', _kept);
END $$;
REVOKE ALL ON FUNCTION public._cancel_or_delete_order_core(uuid, boolean, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cancel_or_delete_order(_order_id uuid, _confirm_number text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._cancel_or_delete_order_core(_order_id, true, _confirm_number);
  RETURN _order_id;
END $$;
REVOKE ALL ON FUNCTION public.cancel_or_delete_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_or_delete_order(uuid, text) TO authenticated;

-- 7) m³-Liste löschen: wie 0046, ruft den Kern ohne Probenlöschung und ohne Bestätigungsnummer auf.
--    Hat der Auftrag Messdaten, bricht der Kern mit dem Hinweis ab, den Auftrag direkt (mit Nummernbestätigung) zu löschen.
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

  -- Wirft bei Messdaten (Nummernbestätigung nötig), Rechten usw.; löscht Auftrag, Anhänge, m³-Liste und Probenzuordnungen.
  PERFORM public._cancel_or_delete_order_core(_q.order_id, false, NULL);

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
