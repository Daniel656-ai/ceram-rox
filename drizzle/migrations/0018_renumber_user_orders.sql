-- Admin-Neu-Nummerierung bestehender Auftragsnummern (additiv; generate_order_number() und Trigger bleiben unverändert)

CREATE OR REPLACE FUNCTION public.preview_renumber_user_orders(_user_id uuid, _year int, _start_value int)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text;
  v_prefix text;
  v_count int;
  v_rows jsonb;
  v_collisions int := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'master') THEN
    RAISE EXCEPTION 'Nur Master dürfen Auftragsnummern neu vergeben';
  END IF;
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Benutzer fehlt'; END IF;
  IF _year IS NULL OR _year < 2000 OR _year > 2099 THEN RAISE EXCEPTION 'Ungültiges Jahr'; END IF;
  IF _start_value IS NULL OR _start_value < 1 OR _start_value > 9999 THEN
    RAISE EXCEPTION 'Startwert muss zwischen 1 und 9999 liegen';
  END IF;

  SELECT short_code INTO v_code FROM public.profiles WHERE user_id = _user_id;
  IF v_code IS NULL OR length(v_code) <> 3 THEN
    RAISE EXCEPTION 'Benutzer hat kein gültiges Kurzzeichen (3 Zeichen erforderlich)';
  END IF;
  v_prefix := upper(v_code) || lpad((_year % 100)::text, 2, '0');

  WITH sel AS (
    SELECT o.id, o.order_number, o.created_at, o.status::text AS status, o.workflow_status::text AS workflow_status,
           row_number() OVER (ORDER BY o.created_at ASC, o.id ASC) AS rn
    FROM public.measurement_orders o
    WHERE o.created_by = _user_id
      AND o.created_at >= make_timestamptz(_year, 1, 1, 0, 0, 0, 'Europe/Vienna')
      AND o.created_at <  make_timestamptz(_year + 1, 1, 1, 0, 0, 0, 'Europe/Vienna')
  ), tgt AS (
    SELECT sel.*, (_start_value + rn - 1) AS counter,
           CASE WHEN _start_value + rn - 1 <= 9999
                THEN v_prefix || lpad((_start_value + rn - 1)::text, 4, '0') END AS new_number
    FROM sel
  ), chk AS (
    SELECT tgt.*, EXISTS (
      SELECT 1 FROM public.measurement_orders x
      WHERE x.order_number IS NOT NULL
        AND upper(btrim(x.order_number)) = upper(btrim(tgt.new_number))
        AND NOT EXISTS (SELECT 1 FROM sel s WHERE s.id = x.id)
    ) AS collision
    FROM tgt
  )
  SELECT count(*)::int,
         COALESCE(jsonb_agg(jsonb_build_object(
           'id', id, 'current_number', order_number, 'new_number', new_number,
           'created_at', created_at, 'status', status, 'workflow_status', workflow_status,
           'collision', collision) ORDER BY rn), '[]'::jsonb),
         count(*) FILTER (WHERE collision)::int
  INTO v_count, v_rows, v_collisions
  FROM chk;

  RETURN jsonb_build_object(
    'user_id', _user_id, 'short_code', v_code, 'prefix', v_prefix, 'year', _year,
    'start_value', _start_value, 'count', v_count,
    'last_counter', CASE WHEN v_count > 0 THEN _start_value + v_count - 1 END,
    'overflow', (v_count > 0 AND _start_value + v_count - 1 > 9999),
    'collision_count', v_collisions,
    'orders', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.renumber_user_orders(
  _user_id uuid, _year int, _start_value int, _reason text, _expected_order_ids uuid[])
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_code text;
  v_prefix text;
  v_ids uuid[];
  v_reason text := btrim(COALESCE(_reason, ''));
  v_count int;
  r record;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'master') THEN
    RAISE EXCEPTION 'Nur Master dürfen Auftragsnummern neu vergeben';
  END IF;
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Benutzer fehlt'; END IF;
  IF _year IS NULL OR _year < 2000 OR _year > 2099 THEN RAISE EXCEPTION 'Ungültiges Jahr'; END IF;
  IF _start_value IS NULL OR _start_value < 1 OR _start_value > 9999 THEN
    RAISE EXCEPTION 'Startwert muss zwischen 1 und 9999 liegen';
  END IF;
  IF length(v_reason) < 5 THEN RAISE EXCEPTION 'Begründung muss mindestens 5 Zeichen haben'; END IF;
  IF _expected_order_ids IS NULL OR cardinality(_expected_order_ids) = 0 THEN
    RAISE EXCEPTION 'Keine Aufträge aus der Vorschau übergeben';
  END IF;

  SELECT short_code INTO v_code FROM public.profiles WHERE user_id = _user_id;
  IF v_code IS NULL OR length(v_code) <> 3 THEN
    RAISE EXCEPTION 'Benutzer hat kein gültiges Kurzzeichen (3 Zeichen erforderlich)';
  END IF;
  v_prefix := upper(v_code) || lpad((_year % 100)::text, 2, '0');

  PERFORM pg_advisory_xact_lock(hashtext('renumber_orders_' || v_prefix));

  -- Zeilen sperren (feste Reihenfolge) und geordnete ID-Liste ermitteln
  PERFORM 1 FROM public.measurement_orders o
   WHERE o.created_by = _user_id
     AND o.created_at >= make_timestamptz(_year, 1, 1, 0, 0, 0, 'Europe/Vienna')
     AND o.created_at <  make_timestamptz(_year + 1, 1, 1, 0, 0, 0, 'Europe/Vienna')
   ORDER BY o.created_at ASC, o.id ASC
   FOR UPDATE;

  SELECT array_agg(o.id ORDER BY o.created_at ASC, o.id ASC) INTO v_ids
  FROM public.measurement_orders o
  WHERE o.created_by = _user_id
    AND o.created_at >= make_timestamptz(_year, 1, 1, 0, 0, 0, 'Europe/Vienna')
    AND o.created_at <  make_timestamptz(_year + 1, 1, 1, 0, 0, 0, 'Europe/Vienna');

  IF v_ids IS NULL OR v_ids IS DISTINCT FROM _expected_order_ids THEN
    RAISE EXCEPTION 'Die Auftragsliste hat sich seit der Vorschau geändert. Bitte Vorschau aktualisieren.';
  END IF;

  v_count := cardinality(v_ids);
  IF _start_value + v_count - 1 > 9999 THEN
    RAISE EXCEPTION 'Zählerüberlauf: letzte benötigte Nummer wäre %', _start_value + v_count - 1;
  END IF;

  CREATE TEMP TABLE _renum ON COMMIT DROP AS
  SELECT u.id, u.ord, o.order_number AS old_number, o.project_id,
         v_prefix || lpad((_start_value + u.ord - 1)::text, 4, '0') AS new_number,
         '__TMP_' || u.id::text AS tmp_number
  FROM unnest(v_ids) WITH ORDINALITY AS u(id, ord)
  JOIN public.measurement_orders o ON o.id = u.id;

  -- Kollisionsprüfung (normalisiert) unmittelbar vor der Änderung
  IF EXISTS (
    SELECT 1 FROM _renum t JOIN public.measurement_orders x
      ON x.order_number IS NOT NULL
     AND upper(btrim(x.order_number)) IN (upper(btrim(t.new_number)), upper(btrim(t.tmp_number)))
    WHERE x.id <> ALL (v_ids)
  ) THEN
    RAISE EXCEPTION 'Kollision mit bestehender Auftragsnummer. Ausführung abgebrochen.';
  END IF;

  PERFORM set_config('app.bypass_order_lock', 'on', true);

  UPDATE public.measurement_orders o SET order_number = t.tmp_number
  FROM _renum t WHERE o.id = t.id;

  UPDATE public.measurement_orders o SET order_number = t.new_number
  FROM _renum t WHERE o.id = t.id;

  PERFORM set_config('app.bypass_order_lock', 'off', true);

  FOR r IN SELECT * FROM _renum ORDER BY ord LOOP
    IF r.old_number IS DISTINCT FROM r.new_number THEN
      INSERT INTO public.activity_log (event_type, actor_user_id, order_id, project_id, metadata)
      VALUES ('order_number_renumbered', v_actor, r.id, r.project_id, jsonb_build_object(
        'old_number', r.old_number, 'new_number', r.new_number, 'reason', v_reason,
        'year', _year, 'start_value', _start_value, 'target_user_id', _user_id));
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.preview_renumber_user_orders(uuid, int, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.renumber_user_orders(uuid, int, int, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_renumber_user_orders(uuid, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.renumber_user_orders(uuid, int, int, text, uuid[]) TO authenticated;