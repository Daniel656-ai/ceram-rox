-- 0040: "Begonnen" für die Bearbeiten-Maske präzisieren (Aufgabe 012, Folgeschritt nach Stufe 1).
--
-- ============================================================================================
-- DATENBANK-/BERECHTIGUNGSÄNDERUNG – vor der Übertragung nach PRODUKTION ist die Freigabe durch
-- Stefan erforderlich. In der Dev-Datenbank wird sie normal über den Merge eingespielt.
-- ============================================================================================
-- Ersetzt NUR die Funktion public.order_edit_facts(uuid) (CREATE OR REPLACE, mehrfach ausführbar).
-- Änderung: Vom Ersteller beim Anlegen vorbefüllte, NICHT offizielle Formularwerte (measurement_results mit
-- result_name 'form:…', gespeichert höchstens 10 Minuten nach Anlage der Aufgabe, measured_by = Ersteller des
-- Auftrags) zählen nicht mehr als "begonnen". Vorher galt ein Auftrag mit verknüpften Formularwerten sofort als
-- begonnen (Auftragstyp/Projekt gesperrt), obwohl noch niemand gearbeitet hatte.
-- UNVERÄNDERT streng bleiben: offizielle Ergebnisse, Ergebnisse anderer Benutzer, spätere Ergebnisse, Rohdaten,
-- Korrekturen, Arbeitszeiten, Dokumente, Uploads, Aufgabenstatus ≠ offen, Zeitbuchungen/Berichte am Auftrag.
-- NICHT geändert: _order_measurement_delete_facts / delete_order_measurement / cancel_or_delete_order /
-- guard_order_delete_dependents / is_order_locked – das Löschen von Dienstleistungen und Aufträgen wird NICHT aufgeweicht.

CREATE OR REPLACE FUNCTION public.order_edit_facts(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _order public.measurement_orders%ROWTYPE;
  _is_master boolean;
  _locked boolean;
  _can_edit boolean;
  _internal boolean;
  _started boolean := false;
  _touched int := 0;
  _ms jsonb := '[]'::jsonb;
  _samples jsonb := '[]'::jsonb;
  _m record;
  _facts jsonb;
  _untouched boolean;
  _blockers jsonb;
  _counts jsonb;
  _prefill int;
  _all_results int;
  _s record;
  _sample_locked boolean;
  _sample_reasons text[];
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Bitte erneut anmelden.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _order FROM public.measurement_orders WHERE id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auftrag nicht gefunden.' USING ERRCODE = 'P0002'; END IF;

  _is_master := public.has_role(_uid, 'master'::public.app_role);
  IF NOT (_is_master OR _order.created_by = _uid OR public.is_assigned_to_order(_uid, _order_id)) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diesen Auftrag.' USING ERRCODE = '42501';
  END IF;

  _locked := public.is_order_locked(_order_id);
  _internal := _order.order_type::text = 'internal';
  _can_edit := (_is_master OR _order.created_by = _uid)
               AND NOT _internal AND NOT _locked
               AND NOT (public.is_external_customer(_uid) AND _order.created_by <> _uid);

  -- Aufgaben: unberührt? (gleiche Kriterien wie das Löschen einer Dienstleistung)
  FOR _m IN SELECT id, created_at FROM public.order_measurements WHERE order_id = _order_id ORDER BY created_at, id LOOP
    _facts := public._order_measurement_delete_facts(_m.id);
    _untouched := COALESCE((_facts->>'allowed')::boolean, false);
    _blockers := COALESCE(_facts->'blockers', '[]'::jsonb);
    _counts := COALESCE(_facts->'counts', '{}'::jsonb);
    _prefill := 0;
    -- 0040: Einziger Sperrgrund "Ergebnisse", und ALLE Ergebnisse sind vom Ersteller beim Anlegen vorbefüllte,
    -- nicht offizielle Formularwerte (result_name 'form:…', gespeichert kurz nach dem Anlegen der Aufgabe)
    -- -> zählt NICHT als "begonnen". Alles andere (offizielle Ergebnisse, Ergebnisse anderer Benutzer,
    -- spätere Ergebnisse, Rohdaten, Korrekturen, Arbeitszeiten, Dokumente, Uploads, Status) sperrt weiter.
    -- Gilt nur für diese Maske; _order_measurement_delete_facts (Löschen von Dienstleistungen) bleibt unverändert.
    IF NOT _untouched AND _blockers = '["results"]'::jsonb THEN
      SELECT count(*) INTO _all_results FROM public.measurement_results WHERE order_measurement_id = _m.id;
      SELECT count(*) INTO _prefill FROM public.measurement_results r
       WHERE r.order_measurement_id = _m.id
         AND r.is_official IS NOT TRUE
         AND r.result_name LIKE 'form:%'
         AND r.measured_by IS NOT DISTINCT FROM _order.created_by
         AND _order.created_by IS NOT NULL
         AND r.created_at <= _m.created_at + interval '10 minutes';
      IF _all_results > 0 AND _prefill = _all_results THEN
        _untouched := true;
        _blockers := '[]'::jsonb;
      END IF;
    END IF;
    IF NOT _untouched THEN _touched := _touched + 1; END IF;
    _ms := _ms || jsonb_build_array(jsonb_build_object(
      'measurement_id', _m.id,
      'measurement_number', _facts->>'measurement_number',
      'service_id', _facts->>'service_id',
      'service_name', _facts->>'service_name',
      'sample_id', (SELECT sample_id FROM public.order_measurements WHERE id = _m.id),
      'status', _facts->>'status',
      'untouched', _untouched,
      'blockers', _blockers,
      'prefill_results', _prefill,
      'counts', _counts));
  END LOOP;

  _started := _order.status::text <> 'open'
              OR _touched > 0
              OR EXISTS (SELECT 1 FROM public.project_time_entries WHERE order_id = _order_id)
              OR EXISTS (SELECT 1 FROM public.order_reports WHERE order_id = _order_id);

  -- Proben: entfernbar nur ohne Aufgaben dieses Auftrags und ohne Ersatzprobe-Verknüpfung.
  FOR _s IN
    SELECT os.id, os.sample_id, os.is_replacement, os.replaces_order_sample_id, os.replaced_by_order_sample_id,
           s.sample_number, s.sample_name
    FROM public.order_samples os LEFT JOIN public.samples s ON s.id = os.sample_id
    WHERE os.order_id = _order_id ORDER BY os.created_at, os.id
  LOOP
    _sample_reasons := ARRAY[]::text[];
    IF EXISTS (SELECT 1 FROM public.order_measurements WHERE order_id = _order_id
               AND (sample_id = _s.sample_id OR original_sample_id = _s.sample_id)) THEN
      _sample_reasons := _sample_reasons || 'has_tasks'::text;
    END IF;
    IF COALESCE(_s.is_replacement, false) OR _s.replaces_order_sample_id IS NOT NULL
       OR _s.replaced_by_order_sample_id IS NOT NULL THEN
      _sample_reasons := _sample_reasons || 'replacement'::text;
    END IF;
    _sample_locked := cardinality(_sample_reasons) > 0;
    _samples := _samples || jsonb_build_array(jsonb_build_object(
      'sample_id', _s.sample_id, 'sample_number', _s.sample_number, 'sample_name', _s.sample_name,
      'locked', _sample_locked, 'reasons', to_jsonb(_sample_reasons)));
  END LOOP;

  RETURN jsonb_build_object(
    'order_id', _order.id,
    'order_number', _order.order_number,
    'order_type', _order.order_type::text,
    'order_kind', _order.order_kind::text,
    'status', _order.status::text,
    'workflow_status', _order.workflow_status::text,
    'project_id', _order.project_id,
    'created_by', _order.created_by,
    'updated_at', _order.updated_at,
    'is_billed', _order.is_billed,
    'is_master', _is_master,
    'can_edit', _can_edit,
    'internal', _internal,
    'locked', _locked,
    'started', _started,
    'type_locked', _started,
    'project_locked', _started,
    'measurements', _ms,
    'samples', _samples);
END $$;
REVOKE ALL ON FUNCTION public.order_edit_facts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_edit_facts(uuid) TO authenticated;
