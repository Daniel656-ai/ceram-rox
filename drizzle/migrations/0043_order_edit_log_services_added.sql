-- 0043: Verlaufseintrag + Benachrichtigung beim HINZUFÜGEN von Dienstleistungen im Bearbeiten-Modus (Aufgabe 012, Stufe 3b).
--
-- ============================================================================================
-- DATENBANK-/BERECHTIGUNGSÄNDERUNG – vor der Übertragung nach PRODUKTION ist die Freigabe durch
-- Stefan erforderlich. In der Dev-Datenbank wird sie normal über den Merge eingespielt.
-- ============================================================================================
-- NEU: public.order_edit_log_services_added(order_id, service_names[], task_count) SECURITY DEFINER
--   Schreibt NUR das Ereignis 'order_updated' (fields = services_added, Dienstleistungsnamen, Anzahl Aufgaben).
--   activity_log erlaubt angemeldeten Benutzern kein direktes INSERT; deshalb diese geprüfte Hilfsfunktion
--   (wie order_edit_log_activity aus 0039). Geprüft: angemeldet, Ersteller oder Master des Auftrags, Auftrag
--   bearbeitbar (order_edit_facts.can_edit), mindestens ein Name. Der Benachrichtigungs-Trigger aus 0041 informiert
--   daraufhin die zugewiesenen Messdienstleister (services_added zählt als relevante Änderung).
--   Die Aufgaben selbst legt – wie beim Erstellen – der Client mit den vorhandenen Berechtigungen an; diese Funktion
--   legt keine Aufgaben an und ändert keine Daten außer dem Protokoll.
-- Mehrfach ausführbar (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.order_edit_log_services_added(_order_id uuid, _service_names text[], _task_count integer DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _order public.measurement_orders%ROWTYPE;
  _names text[];
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Bitte erneut anmelden.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _order FROM public.measurement_orders WHERE id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auftrag nicht gefunden.' USING ERRCODE = 'P0002'; END IF;
  IF NOT (public.has_role(_uid, 'master'::public.app_role) OR _order.created_by = _uid) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Bearbeiten dieses Auftrags.' USING ERRCODE = '42501';
  END IF;
  IF NOT COALESCE((public.order_edit_facts(_order_id)->>'can_edit')::boolean, false) THEN
    RAISE EXCEPTION 'Dieser Auftrag kann nicht bearbeitet werden.' USING ERRCODE = '42501';
  END IF;
  _names := ARRAY(SELECT DISTINCT left(btrim(n), 200) FROM unnest(COALESCE(_service_names, ARRAY[]::text[])) n WHERE btrim(COALESCE(n, '')) <> '');
  IF cardinality(_names) = 0 THEN RAISE EXCEPTION 'Keine Dienstleistung angegeben.'; END IF;
  IF cardinality(_names) > 50 THEN RAISE EXCEPTION 'Zu viele Dienstleistungen.'; END IF;

  INSERT INTO public.activity_log (event_type, actor_user_id, order_id, project_id, metadata)
  VALUES ('order_updated', _uid, _order_id, _order.project_id,
          jsonb_build_object('fields', jsonb_build_array('services_added'),
                             'services_added', to_jsonb(_names),
                             'tasks_added', _task_count))
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.order_edit_log_services_added(uuid, text[], integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_edit_log_services_added(uuid, text[], integer) TO authenticated;

COMMENT ON FUNCTION public.order_edit_log_services_added(uuid, text[], integer) IS
  'Aufgabe 012 Stufe 3b: Protokolleintrag (und Benachrichtigung über Trigger 0041) für im Bearbeiten-Modus hinzugefügte Dienstleistungen.';
