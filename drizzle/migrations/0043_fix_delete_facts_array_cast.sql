-- 0043: Korrektur von public._order_measurement_delete_facts (Fehler "malformed array literal: \"status_not_open\"").
--
-- ============================================================================================
-- DATENBANK-/BERECHTIGUNGSÄNDERUNG – vor der Übertragung nach PRODUKTION ist die Freigabe durch
-- Stefan erforderlich. In der Dev-Datenbank wird sie normal über den Merge eingespielt.
-- ============================================================================================
-- Ursache: In 0020 steht  _blockers := _blockers || 'status_not_open';  (text[] || unbekanntes Literal). PostgreSQL deutet das
-- Literal dann als Array-Literal und bricht ab ("malformed array literal"), sobald EIN Sperrgrund vorliegt (z. B. Aufgabe
-- nicht mehr "offen"). Betroffen: die Master-Löschung (preview_/delete_order_measurement), die Bearbeiten-Sperren
-- (order_edit_facts) und alles, was _order_measurement_delete_facts aufruft – bei Aufträgen ohne Sperrgrund trat der Fehler nicht auf.
-- Korrektur: ausschließlich explizite Typangabe ('…'::text) an den 8 Stellen. Die Fachlogik (welche Sperrgründe es gibt, wann
-- "allowed") ist UNVERÄNDERT – es wird nichts aufgeweicht. Die Datei 0020 bleibt unangetastet.
-- Mehrfach ausführbar (CREATE OR REPLACE; Rechte unverändert wie in 0020).

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

  IF _locked THEN _blockers := _blockers || 'order_locked'::text; END IF;
  IF _row.status::text <> 'open' THEN _blockers := _blockers || 'status_not_open'::text; END IF;
  IF n_results > 0 THEN _blockers := _blockers || 'results'::text; END IF;
  IF n_raw > 0 THEN _blockers := _blockers || 'raw_data'::text; END IF;
  IF n_corr > 0 THEN _blockers := _blockers || 'corrections'::text; END IF;
  IF n_logs > 0 THEN _blockers := _blockers || 'work_logs'::text; END IF;
  IF n_docs > 0 THEN _blockers := _blockers || 'documents'::text; END IF;
  IF n_uploads > 0 THEN _blockers := _blockers || 'uploads'::text; END IF;

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
