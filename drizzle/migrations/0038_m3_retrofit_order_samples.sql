CREATE OR REPLACE FUNCTION public.m3_retrofit_order_samples(_order_id uuid, _plan jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _o public.measurement_orders%ROWTYPE;
  _s jsonb; _a jsonb; _t jsonb;
  _new_id uuid; _num text; _sid uuid;
  _map jsonb := '{}'::jsonb;
  _created int := 0; _linked int := 0; _assigned int := 0; _tasks int := 0;
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'master'::public.app_role) THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen m³-Proben nachrüsten.' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('m3_retrofit:' || _order_id::text, 0));
  SELECT * INTO _o FROM public.measurement_orders WHERE id=_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auftrag nicht gefunden.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.production_document_requests WHERE order_id=_order_id AND doc_kind='m3_list') THEN
    RAISE EXCEPTION 'Auftrag stammt nicht aus einer m³-Liste.';
  END IF;

  -- Fehlende Proben anlegen (vorher erneut auf vergebene Nummern prüfen).
  FOR _s IN SELECT * FROM jsonb_array_elements(coalesce(_plan->'samples','[]'::jsonb)) LOOP
    _num := btrim(_s->>'sample_number');
    IF _num IS NULL OR _num !~ '^.{9}-\d{5}$' THEN RAISE EXCEPTION 'Ungültige Probennummer %', _num; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('sample_number:' || _num, 0));
    IF EXISTS (SELECT 1 FROM public.samples WHERE sample_number=_num) THEN
      RAISE EXCEPTION 'Probennummer % ist inzwischen vergeben – keine Änderungen übernommen.', _num;
    END IF;
    INSERT INTO public.samples(sample_number, sample_name, description, created_by, project_id, order_id, status, is_hazardous, hazard_categories, tags)
      VALUES (_num, coalesce(_s->>'sample_name', _num), coalesce(_s->>'description',''), _uid, _o.project_id, _order_id, 'neu', false, '{}', ARRAY['m3_beprobung'])
      RETURNING id INTO _new_id;
    IF (SELECT sample_number FROM public.samples WHERE id=_new_id) <> _num THEN
      RAISE EXCEPTION 'Datenbank hat die Probennummer % ersetzt – Datenbankanpassung fehlt.', _num;
    END IF;
    INSERT INTO public.sample_history(sample_id, action, user_id, details)
      VALUES (_new_id, 'created', _uid, jsonb_build_object('source','m3_retrofit','order_id',_order_id,'element_number',_s->>'element_number'));
    INSERT INTO public.order_samples(order_id, sample_id, created_by) VALUES (_order_id, _new_id, _uid) ON CONFLICT DO NOTHING;
    _map := _map || jsonb_build_object(_num, _new_id);
    _created := _created + 1;
  END LOOP;

  -- Vorhandene, eindeutig diesem Auftrag gehörende Proben ergänzend verknüpfen.
  FOR _s IN SELECT * FROM jsonb_array_elements(coalesce(_plan->'links','[]'::jsonb)) LOOP
    SELECT id, sample_number INTO _sid, _num FROM public.samples WHERE id=(_s->>'sample_id')::uuid AND order_id=_order_id;
    IF _sid IS NULL THEN RAISE EXCEPTION 'Probe gehört nicht eindeutig zu diesem Auftrag.'; END IF;
    INSERT INTO public.order_samples(order_id, sample_id, created_by) VALUES (_order_id, _sid, _uid) ON CONFLICT DO NOTHING;
    IF FOUND THEN _linked := _linked + 1; END IF;
    _map := _map || jsonb_build_object(_num, _sid);
  END LOOP;
  -- Bereits verknüpfte Proben für Zuordnungen bekannt machen.
  SELECT _map || coalesce(jsonb_object_agg(s.sample_number, s.id), '{}'::jsonb) INTO _map
    FROM public.order_samples os JOIN public.samples s ON s.id=os.sample_id WHERE os.order_id=_order_id;

  -- Offene, unzugeordnete Aufgaben eindeutig einer Probe zuordnen.
  FOR _a IN SELECT * FROM jsonb_array_elements(coalesce(_plan->'assignments','[]'::jsonb)) LOOP
    _sid := (_map->>(_a->>'sample_number'))::uuid;
    IF _sid IS NULL THEN RAISE EXCEPTION 'Probe % nicht vorhanden.', _a->>'sample_number'; END IF;
    UPDATE public.order_measurements SET sample_id=_sid
      WHERE id=(_a->>'measurement_id')::uuid AND order_id=_order_id AND sample_id IS NULL AND status::text='open'
        AND NOT EXISTS (SELECT 1 FROM public.measurement_results r WHERE r.order_measurement_id=order_measurements.id);
    IF NOT FOUND THEN RAISE EXCEPTION 'Aufgabe ist nicht mehr offen/unzugeordnet – keine Änderungen übernommen.'; END IF;
    _assigned := _assigned + 1;
  END LOOP;

  -- Fehlende offene Aufgaben je Probe und Dienstleistung ergänzen.
  FOR _t IN SELECT * FROM jsonb_array_elements(coalesce(_plan->'new_tasks','[]'::jsonb)) LOOP
    IF _o.status::text = 'completed' THEN RAISE EXCEPTION 'Abgeschlossener Auftrag – keine neuen Aufgaben.'; END IF;
    _sid := (_map->>(_t->>'sample_number'))::uuid;
    IF _sid IS NULL THEN RAISE EXCEPTION 'Probe % nicht vorhanden.', _t->>'sample_number'; END IF;
    IF EXISTS (SELECT 1 FROM public.order_measurements WHERE order_id=_order_id AND service_id=(_t->>'service_id')::uuid AND sample_id=_sid) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.order_measurements(order_id, service_id, sample_id, measurement_number)
      VALUES (_order_id, (_t->>'service_id')::uuid, _sid, 'WILL_BE_OVERWRITTEN');
    _tasks := _tasks + 1;
  END LOOP;

  INSERT INTO public.activity_log(event_type, actor_user_id, project_id, order_id, metadata)
    VALUES ('m3_samples_retrofitted', _uid, _o.project_id, _order_id,
      jsonb_build_object('order_number', _o.order_number, 'created', _created, 'linked', _linked, 'assigned', _assigned, 'new_tasks', _tasks, 'plan', _plan));
  RETURN jsonb_build_object('created', _created, 'linked', _linked, 'assigned', _assigned, 'new_tasks', _tasks);
END $$;
REVOKE ALL ON FUNCTION public.m3_retrofit_order_samples(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.m3_retrofit_order_samples(uuid, jsonb) TO authenticated;