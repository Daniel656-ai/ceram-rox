-- m³-Liste löschen (Aufgabe 006).
-- BERECHTIGUNGSÄNDERUNG: Löschen auf production_document_requests nur noch für den Ersteller
-- (requested_by) und Master. Bisher durfte jeder angemeldete Benutzer löschen (Policy "ALL ... true").
-- Lesen, Anlegen und Ändern bleiben unverändert.
-- Vorher (supabase/migrations/20260909064137): zwei Regeln
--   SELECT: "All authenticated read production_document_requests"      USING (true)
--   ALL   : "Authenticated manage production_document_requests"        USING (true) WITH CHECK (true)
-- Nachher: SELECT unverändert; INSERT und UPDATE exakt wie vorher (true); DELETE nur Ersteller/Master.
-- Entfernt werden nur erlaubende (PERMISSIVE) Regeln für ALL/DELETE, die ein Löschen für alle erlauben würden.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'production_document_requests'
             AND permissive = 'PERMISSIVE' AND cmd IN ('ALL', 'DELETE')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.production_document_requests', p.policyname);
  END LOOP;
END $$;
-- Abgleich mit Lovable (Prod, 0040): INSERT/UPDATE-Regeln mit gleichem Namen und Inhalt existieren dort bereits.
-- Vorher entfernen, damit die Migration auf frischer Dev-DB, nach Lovable und auf Prod gleich durchläuft.
DROP POLICY IF EXISTS "Authenticated insert production_document_requests" ON public.production_document_requests;
DROP POLICY IF EXISTS "Authenticated update production_document_requests" ON public.production_document_requests;
CREATE POLICY "Authenticated insert production_document_requests"
  ON public.production_document_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update production_document_requests"
  ON public.production_document_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Creator or master delete production_document_requests"
  ON public.production_document_requests FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'master'::public.app_role) OR requested_by = auth.uid());

-- Selbstprüfung: Lesen, Anlegen und Ändern müssen weiterhin für alle Angemeldeten möglich sein,
-- genau eine DELETE-Regel (die neue) darf gelten. Sonst bricht die Migration ab (nichts wird übernommen).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='production_document_requests'
                 AND permissive='PERMISSIVE' AND cmd='SELECT' AND qual='true') THEN
    RAISE EXCEPTION 'production_document_requests: SELECT-Regel für alle Angemeldeten fehlt';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='production_document_requests'
                 AND permissive='PERMISSIVE' AND cmd='INSERT' AND with_check='true') THEN
    RAISE EXCEPTION 'production_document_requests: INSERT-Regel für alle Angemeldeten fehlt';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='production_document_requests'
                 AND permissive='PERMISSIVE' AND cmd='UPDATE' AND qual='true' AND with_check='true') THEN
    RAISE EXCEPTION 'production_document_requests: UPDATE-Regel für alle Angemeldeten fehlt';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='production_document_requests'
        AND permissive='PERMISSIVE' AND cmd IN ('DELETE','ALL')) <> 1 THEN
    RAISE EXCEPTION 'production_document_requests: es muss genau eine DELETE-Regel geben';
  END IF;
END $$;

-- 1) Welche der am Auftrag hängenden Proben dürfen mitgelöscht werden?
--    Nur Proben, die aus der m³-Liste erzeugt wurden (Beschreibung "Aus m³-Liste …"), Status "neu",
--    und an denen NICHTS hängt außer der Zuordnung zu diesem Auftrag (order_samples) und dem
--    automatischen "angelegt"-Eintrag der Probenhistorie. Sonst bleibt die Probe stehen (mit Grund).
CREATE OR REPLACE FUNCTION public.m3_list_sample_plan(_order_id uuid)
RETURNS TABLE(sample_id uuid, sample_name text, deletable boolean, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; _r text[];
BEGIN
  FOR s IN
    SELECT sa.id, sa.sample_name, sa.description, sa.status::text AS status
    FROM public.order_samples os JOIN public.samples sa ON sa.id = os.sample_id
    WHERE os.order_id = _order_id ORDER BY sa.sample_name
  LOOP
    _r := ARRAY[]::text[];
    IF s.description IS NULL OR s.description NOT LIKE 'Aus m³-Liste%' THEN _r := _r || 'nicht aus der m³-Liste erzeugt'; END IF;
    IF s.status <> 'neu' THEN _r := _r || 'Status nicht „neu“'; END IF;
    IF EXISTS(SELECT 1 FROM public.order_samples o2 WHERE o2.sample_id = s.id AND o2.order_id <> _order_id)
      OR EXISTS(SELECT 1 FROM public.measurement_orders mo WHERE mo.sample_id = s.id AND mo.id <> _order_id)
      THEN _r := _r || 'an einem weiteren Auftrag'; END IF;
    IF EXISTS(SELECT 1 FROM public.order_measurements m WHERE m.sample_id = s.id OR m.original_sample_id = s.id)
      THEN _r := _r || 'an einer Messung'; END IF;
    IF EXISTS(SELECT 1 FROM public.measurement_raw_datasets d WHERE d.sample_id = s.id) THEN _r := _r || 'Rohdaten vorhanden'; END IF;
    IF EXISTS(SELECT 1 FROM public.order_step_positions p WHERE p.sample_id = s.id)
      OR EXISTS(SELECT 1 FROM public.order_workflow_task_positions p WHERE p.sample_id = s.id)
      THEN _r := _r || 'an einer Aufgabenposition'; END IF;
    IF EXISTS(SELECT 1 FROM public.pilot_plant_produced_samples p WHERE p.created_sample_id = s.id)
      THEN _r := _r || 'Technikumsprobe'; END IF;
    IF EXISTS(SELECT 1 FROM public.sample_documents d WHERE d.sample_id = s.id) THEN _r := _r || 'Probendokumente vorhanden'; END IF;
    IF EXISTS(SELECT 1 FROM public.sample_geometry_datasets d WHERE d.sample_id = s.id) THEN _r := _r || 'Geometriedaten vorhanden'; END IF;
    IF EXISTS(SELECT 1 FROM public.sample_history h WHERE h.sample_id = s.id AND h.action <> 'created')
      THEN _r := _r || 'Probenhistorie (Status-/Lagerortwechsel)'; END IF;
    IF EXISTS(SELECT 1 FROM public.samples c WHERE c.parent_sample_id = s.id) THEN _r := _r || 'Unterproben vorhanden'; END IF;
    sample_id := s.id; sample_name := s.sample_name;
    deletable := cardinality(_r) = 0;
    reason := CASE WHEN cardinality(_r) = 0 THEN NULL ELSE array_to_string(_r, ', ') END;
    RETURN NEXT;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.m3_list_sample_plan(uuid) FROM PUBLIC, anon, authenticated;

-- 2) Vorschau für den Dialog (Rechteprüfung: Ersteller der m³-Liste oder Master).
CREATE OR REPLACE FUNCTION public.m3_list_delete_plan(_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _q public.production_document_requests%ROWTYPE;
  _o public.measurement_orders%ROWTYPE;
  _blocked text := NULL;
  _has_results boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Bitte erneut anmelden.' USING ERRCODE='42501'; END IF;
  SELECT * INTO _q FROM public.production_document_requests WHERE id = _request_id AND doc_kind = 'm3_list';
  IF NOT FOUND THEN RAISE EXCEPTION 'm³-Liste nicht vorhanden.' USING ERRCODE='P0002'; END IF;
  IF NOT (public.has_role(_uid, 'master'::public.app_role) OR _q.requested_by = _uid) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diese m³-Liste.' USING ERRCODE='42501';
  END IF;
  IF _q.order_id IS NULL THEN
    RETURN jsonb_build_object('order_id', NULL, 'blocked_reason', NULL, 'has_results', false,
      'samples', '[]'::jsonb, 'attachments', '{}'::jsonb);
  END IF;
  SELECT * INTO _o FROM public.measurement_orders WHERE id = _q.order_id;
  _has_results := public.order_has_results(_q.order_id);
  IF _has_results THEN
    _blocked := 'Der Beprobungsauftrag ' || coalesce(_o.order_number, '') || ' hat bereits Messergebnisse. Die m³-Liste kann nicht gelöscht werden.';
  ELSIF NOT (public.has_role(_uid, 'master'::public.app_role) OR _o.created_by = _uid) THEN
    _blocked := 'Der Beprobungsauftrag ' || coalesce(_o.order_number, '') || ' gehört einem anderen Benutzer.';
  ELSIF public.is_order_locked(_q.order_id) THEN
    _blocked := 'Der Beprobungsauftrag ' || coalesce(_o.order_number, '') || ' ist gesperrt.';
  ELSIF _o.status::text <> 'open' THEN
    _blocked := 'Der Beprobungsauftrag ' || coalesce(_o.order_number, '') || ' ist nicht mehr offen (bereits bearbeitet).';
  END IF;
  RETURN jsonb_build_object(
    'order_id', _q.order_id, 'order_number', _o.order_number,
    'blocked_reason', _blocked, 'has_results', _has_results,
    'samples', coalesce((SELECT jsonb_agg(jsonb_build_object('name', p.sample_name, 'deletable', p.deletable, 'reason', p.reason)
                                          ORDER BY p.sample_name)
                         FROM public.m3_list_sample_plan(_q.order_id) p), '[]'::jsonb),
    'attachments', public.order_delete_attachments(_q.order_id)
  );
END $$;
REVOKE ALL ON FUNCTION public.m3_list_delete_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.m3_list_delete_plan(uuid) TO authenticated;

-- 3) Löschen. Ohne Auftrag: nur die m³-Liste. Mit Auftrag: über die bestehende Funktion
--    cancel_or_delete_order (alle Sperren und der Schutz-Trigger guard_order_delete_dependents
--    bleiben unverändert wirksam; sie löscht auch die m³-Liste und löst die Freigabe). Danach werden
--    die dafür erzeugten Proben gelöscht, aber nur die, die der Plan oben als löschbar einstuft.
--    Alles in einer Transaktion: scheitert ein Schritt, bleibt alles unverändert.
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

  -- Wirft bei Ergebnissen, Sperren, Rechten usw.; löscht Auftrag, Anhänge, m³-Liste und Probenzuordnungen.
  PERFORM public.cancel_or_delete_order(_q.order_id);

  -- Erneute Prüfung direkt vor dem Löschen (Zuordnung zu diesem Auftrag ist jetzt weg).
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
