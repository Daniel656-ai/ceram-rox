-- 0041: Benachrichtigung der zugewiesenen Messdienstleister bei relevanten Auftragsänderungen (Aufgabe 012, Stufe 4).
--
-- ============================================================================================
-- DATENBANK-/BERECHTIGUNGSÄNDERUNG – vor der Übertragung nach PRODUKTION ist die Freigabe durch
-- Stefan erforderlich. In der Dev-Datenbank wird sie normal über den Merge eingespielt.
-- ============================================================================================
-- Neu: Trigger-Funktion public.order_edit_notify_assignees() + AFTER-INSERT-Trigger auf activity_log (nur für die
-- Ereignisse 'order_updated' und 'order_spec_updated'). Sie legt je zugewiesenem Messdienstleister EINE Benachrichtigung
-- (Tabelle notifications, Glocke) an. Die Tabellen-Policies bleiben unverändert ("Only triggers insert notifications"):
-- die Funktion ist SECURITY DEFINER und nur als Trigger aufrufbar (EXECUTE für PUBLIC/anon/authenticated entzogen).
--
-- Wer wird benachrichtigt:
--   * 'order_updated'      : alle Benutzer, denen Aufgaben des Auftrags zugewiesen sind (order_measurements.assigned_to),
--                            außer der Person, die die Änderung gemacht hat – NUR wenn mindestens eines der Felder
--                            samples_added, samples_removed, services_added, services_removed, template (Auftragsformular),
--                            due_date oder priority geändert wurde. Nur Anmerkungen / Auftragstyp / Projekt: keine Benachrichtigung.
--   * 'order_spec_updated' : nur der Person, der die betroffene Aufgabe zugewiesen ist (außer dem Akteur).
-- Mehrfach ausführbar (CREATE OR REPLACE, DROP TRIGGER IF EXISTS). Die Funktion ändert keine bestehenden Daten.

CREATE OR REPLACE FUNCTION public.order_edit_notify_assignees()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _relevant boolean := false;
  _field text;
BEGIN
  IF NEW.order_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.event_type = 'order_updated' THEN
    IF jsonb_typeof(NEW.metadata->'fields') = 'array' THEN
      FOR _field IN SELECT jsonb_array_elements_text(NEW.metadata->'fields') LOOP
        IF _field IN ('samples_added', 'samples_removed', 'services_added', 'services_removed', 'template', 'due_date', 'priority') THEN
          _relevant := true;
        END IF;
      END LOOP;
    END IF;
    IF NOT _relevant THEN RETURN NEW; END IF;

    INSERT INTO public.notifications (user_id, activity_id)
    SELECT DISTINCT om.assigned_to, NEW.id
      FROM public.order_measurements om
     WHERE om.order_id = NEW.order_id
       AND om.assigned_to IS NOT NULL
       AND om.assigned_to IS DISTINCT FROM NEW.actor_user_id;

  ELSIF NEW.event_type = 'order_spec_updated' THEN
    IF NEW.order_measurement_id IS NULL THEN RETURN NEW; END IF;
    INSERT INTO public.notifications (user_id, activity_id)
    SELECT om.assigned_to, NEW.id
      FROM public.order_measurements om
     WHERE om.id = NEW.order_measurement_id
       AND om.assigned_to IS NOT NULL
       AND om.assigned_to IS DISTINCT FROM NEW.actor_user_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.order_edit_notify_assignees() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_order_edit_notify_assignees ON public.activity_log;
CREATE TRIGGER trg_order_edit_notify_assignees
  AFTER INSERT ON public.activity_log
  FOR EACH ROW
  WHEN (NEW.event_type IN ('order_updated', 'order_spec_updated'))
  EXECUTE FUNCTION public.order_edit_notify_assignees();

COMMENT ON FUNCTION public.order_edit_notify_assignees() IS
  'Trigger: Benachrichtigung (Glocke) der zugewiesenen Messdienstleister bei relevanten Auftragsänderungen (Aufgabe 012, Stufe 4).';
