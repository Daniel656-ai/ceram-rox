-- 0020: Einzelne Dienstleistung (order_measurements-Zeile) eines Auftrags durch ROX-Admin (Basisrolle master) sicher löschen.
-- Additiv: zwei neue SECURITY DEFINER-Funktionen. Keine Tabellen-, Spalten-, Policy-, Index- oder Rechteänderung an Tabellen.

CREATE OR REPLACE FUNCTION public._order_measurement_delete_facts(_measurement_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _row public.order_measurements%ROWTYPE;
  _order public.measurement_orders%ROWTYPE;
  _service text;
  _blockers text[] := ARRAY[]::text[];
  _c jsonb;
  _locked boolean;
  n_results int; n_raw int; n_corr int; n_logs int; n_docs int; n_uploads int;
  n_params int; n_samples int; n_repl int; n_knet int; n_hist int;
BEGIN
  SELECT * INTO _row FROM public.order_measurements WHERE id = _measurement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'measurement not found'; END IF;
  SELECT * INTO _order FROM public.measurement_orders WHERE id = _row.order_id;
  SELECT service_name INTO _service FROM public.measurement_services WHERE id = _row.service_id;
  _locked := public.is_order_locked(_row.order_id);

  SELECT count(*) INTO n_results FROM public.measurement_results WHERE order_measurement_id = _row.id;
  SELECT count(*) INTO n_raw FROM public.measurement_raw_datasets WHERE order_measurement_id = _row.id;
  SELECT count(*) INTO n_corr FROM public.measurement_result_corrections WHERE order_measurement_id = _row.id;
  SELECT count(*) INTO n_logs FROM public.work_logs WHERE order_measurement_id = _row.id;
  SELECT count(*) INTO n_docs FROM public.documents WHERE order_measurement_id = _row.id;
  SELECT count(*) INTO n_uploads FROM public.order_upload_files WHERE measurement_id = _row.id;
  SELECT count(*) INTO n_params FROM public.measurement_parameters WHERE order_measurement_id = _row.id;
  SELECT count(*) INTO n_samples FROM public.samples WHERE prepared_for_measurement_id = _row.id;
  SELECT count(*) INTO n_repl FROM public.order_measurements WHERE source_measurement_id = _row.id;
  SELECT count(*) INTO n_knet FROM public.project_knetung_materials WHERE order_measurement_id = _row.id;
  SELECT count(*) INTO n_hist FROM public.activity_log WHERE order_measurement_id = _row.id;

  IF _locked THEN _blockers := _blockers || 'order_locked'; END IF;
  IF _row.status::text <> 'open' THEN _blockers := _blockers || 'status_not_open'; END IF;
  IF n_results > 0 THEN _blockers := _blockers || 'results'; END IF;
  IF n_raw > 0 THEN _blockers := _blockers || 'raw_data'; END IF;
  IF n_corr > 0 THEN _blockers := _blockers || 'corrections'; END IF;
  IF n_logs > 0 THEN _blockers := _blockers || 'work_logs'; END IF;
  IF n_docs > 0 THEN _blockers := _blockers || 'documents'; END IF;
  IF n_uploads > 0 THEN _blockers := _blockers || 'uploads'; END IF;

  _c := jsonb_build_object('results', n_results, 'raw_data', n_raw, 'corrections', n_corr,
          'work_logs', n_logs, 'documents', n_docs, 'uploads', n_uploads,
          'parameters', n_params, 'prepared_samples', n_samples, 'replacement_measurements', n_repl,
          'knetung_materials', n_knet, 'history_entries', n_hist);

  RETURN jsonb_build_object(
    'measurement_id', _row.id, 'measurement_number', _row.measurement_number,
    'order_id', _row.order_id, 'order_number', _order.order_number, 'project_id', _order.project_id,
    'service_id', _row.service_id, 'service_name', _service, 'status', _row.status::text,
    'assigned_to', _row.assigned_to, 'order_locked', _locked,
    'counts', _c, 'blockers', to_jsonb(_blockers), 'allowed', cardinality(_blockers) = 0);
END $$;
REVOKE ALL ON FUNCTION public._order_measurement_delete_facts(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.preview_delete_order_measurement(_measurement_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.has_role(auth.uid(), 'master'::app_role) THEN RAISE EXCEPTION 'not permitted'; END IF;
  RETURN public._order_measurement_delete_facts(_measurement_id);
END $$;
REVOKE ALL ON FUNCTION public.preview_delete_order_measurement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_delete_order_measurement(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_order_measurement(_measurement_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _order_id uuid;
  _facts jsonb;
  _params jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.has_role(_uid, 'master'::app_role) THEN RAISE EXCEPTION 'not permitted'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN RAISE EXCEPTION 'reason too short'; END IF;

  -- Parallele Änderungen: erst Auftrag, dann Aufgabe sperren (gleiche Reihenfolge wie Statusabgleich).
  SELECT order_id INTO _order_id FROM public.order_measurements WHERE id = _measurement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'measurement not found'; END IF;
  PERFORM 1 FROM public.measurement_orders WHERE id = _order_id FOR UPDATE;
  PERFORM 1 FROM public.order_measurements WHERE id = _measurement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'measurement not found'; END IF;

  _facts := public._order_measurement_delete_facts(_measurement_id);
  IF NOT (_facts->>'allowed')::boolean THEN
    RAISE EXCEPTION 'delete blocked: %', (SELECT string_agg(b, ',') FROM jsonb_array_elements_text(_facts->'blockers') b);
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object('name', parameter_name, 'value', parameter_value)), '[]'::jsonb)
    INTO _params FROM public.measurement_parameters WHERE order_measurement_id = _measurement_id;

  -- Bestehende Historie der Aufgabe erhalten (sonst ON DELETE CASCADE): Bezug lösen, Auftragsbezug bleibt.
  UPDATE public.activity_log
     SET order_measurement_id = NULL,
         metadata = metadata || jsonb_build_object('deleted_measurement_id', _measurement_id,
                                                   'deleted_measurement_number', _facts->>'measurement_number')
   WHERE order_measurement_id = _measurement_id;

  -- Audit-Eintrag auf Auftragsebene (ohne Aufgabenbezug → bleibt nach dem Löschen erhalten).
  INSERT INTO public.activity_log (event_type, actor_user_id, order_id, order_measurement_id, project_id, service_id, metadata)
  VALUES ('measurement_deleted', _uid, _order_id, NULL, (_facts->>'project_id')::uuid, (_facts->>'service_id')::uuid,
          jsonb_build_object('order_number', _facts->>'order_number',
                             'measurement_id', _measurement_id,
                             'measurement_number', _facts->>'measurement_number',
                             'service_name', _facts->>'service_name',
                             'status', _facts->>'status',
                             'assigned_to', _facts->'assigned_to',
                             'reason', btrim(_reason),
                             'deleted_at', now(),
                             'counts', _facts->'counts',
                             'deleted_parameters', _params));

  -- Löschen: Vorgaben werden mitgelöscht (im Audit gesichert); Teilproben-/Ersatzmessungs-/Knetungsbezüge werden per FK entkoppelt.
  -- Auftragsstatus wird durch den bestehenden Trigger trg_workflow_measurements neu berechnet. Auftragssperre zusätzlich durch trg_lock_om.
  DELETE FROM public.order_measurements WHERE id = _measurement_id;
  RETURN _measurement_id;
END $$;
REVOKE ALL ON FUNCTION public.delete_order_measurement(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_order_measurement(uuid, text) TO authenticated;