-- 1) Rekursive Expansion: auch automatisch erzeugte Schritte ziehen ihre
--    eigenen erforderlichen Vorleistungen nach. Die Duplikatspruefung
--    (order_id, service_id, sample_id) beendet Zyklen zuverlaessig.
CREATE OR REPLACE FUNCTION public.trg_expand_service_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.origin IN ('booked','package','workflow') THEN
      PERFORM public.expand_service_workflow(NEW.id);
    END IF;
  ELSIF NEW.service_id IS DISTINCT FROM OLD.service_id
        AND NEW.origin IN ('booked','package') THEN
    PERFORM public.expand_service_workflow(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Expansion verknuepft vorhandene Aufgaben mit dem Workflow-Schritt,
--    statt sie doppelt anzulegen.
CREATE OR REPLACE FUNCTION public.expand_service_workflow(_measurement_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m           public.order_measurements%ROWTYPE;
  tpl_id      uuid;
  st          RECORD;
  lk          RECORD;
  dep         RECORD;
  own_step    RECORD;
  existing_id uuid;
  created     integer := 0;
BEGIN
  SELECT * INTO m FROM public.order_measurements WHERE id = _measurement_id;
  IF NOT FOUND OR m.service_id IS NULL THEN
    RETURN 0;
  END IF;

  -- a) Direkte, formularunabhaengige Dienstleistungsabhaengigkeiten
  FOR dep IN
    SELECT d.requires_service_id, d.order_index
    FROM public.service_dependencies d
    WHERE d.service_id = m.service_id
      AND d.requires_service_id <> m.service_id
    ORDER BY d.order_index
  LOOP
    SELECT x.id INTO existing_id FROM public.order_measurements x
    WHERE x.order_id = m.order_id
      AND x.service_id = dep.requires_service_id
      AND x.sample_id IS NOT DISTINCT FROM m.sample_id
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      UPDATE public.order_measurements
        SET source_measurement_id = COALESCE(source_measurement_id, m.id)
      WHERE id = existing_id;
      CONTINUE;
    END IF;

    INSERT INTO public.order_measurements
      (order_id, service_id, sample_id, status, priority, origin, source_measurement_id)
    VALUES
      (m.order_id, dep.requires_service_id, m.sample_id, 'open', m.priority, 'workflow', m.id);

    created := created + 1;
  END LOOP;

  SELECT process_template_id INTO tpl_id
  FROM public.measurement_services WHERE id = m.service_id;

  IF tpl_id IS NULL THEN
    RETURN created;
  END IF;

  SELECT * INTO own_step
  FROM public.process_steps
  WHERE template_id = tpl_id AND step_kind = 'service' AND service_id = m.service_id
  ORDER BY order_index DESC
  LIMIT 1;

  IF own_step.id IS NOT NULL THEN
    UPDATE public.order_measurements
      SET source_step_key = COALESCE(source_step_key, own_step.step_key),
          depends_on_step_keys = own_step.depends_on_step_keys
    WHERE id = m.id;
  END IF;

  FOR st IN
    SELECT * FROM public.process_steps
    WHERE template_id = tpl_id
      AND step_kind = 'service'
      AND service_id IS NOT NULL
      AND service_id <> m.service_id
      AND (own_step.id IS NULL OR order_index < own_step.order_index)
    ORDER BY order_index
  LOOP
    SELECT x.id INTO existing_id FROM public.order_measurements x
    WHERE x.order_id = m.order_id
      AND x.service_id = st.service_id
      AND x.sample_id IS NOT DISTINCT FROM m.sample_id
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      UPDATE public.order_measurements
        SET source_measurement_id = COALESCE(source_measurement_id, m.id),
            source_step_key = COALESCE(source_step_key, st.step_key)
      WHERE id = existing_id;
      CONTINUE;
    END IF;

    INSERT INTO public.order_measurements
      (order_id, service_id, sample_id, status, priority, origin,
       source_measurement_id, source_step_key, depends_on_step_keys)
    VALUES
      (m.order_id, st.service_id, m.sample_id, 'open', m.priority, 'workflow',
       m.id, st.step_key, st.depends_on_step_keys);

    created := created + 1;
  END LOOP;

  FOR lk IN
    SELECT l.service_id, l.order_index
    FROM public.process_service_links l
    WHERE l.process_template_id = tpl_id
      AND l.service_id IS NOT NULL
      AND l.service_id <> m.service_id
    ORDER BY l.order_index
  LOOP
    SELECT x.id INTO existing_id FROM public.order_measurements x
    WHERE x.order_id = m.order_id
      AND x.service_id = lk.service_id
      AND x.sample_id IS NOT DISTINCT FROM m.sample_id
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      UPDATE public.order_measurements
        SET source_measurement_id = COALESCE(source_measurement_id, m.id)
      WHERE id = existing_id;
      CONTINUE;
    END IF;

    INSERT INTO public.order_measurements
      (order_id, service_id, sample_id, status, priority, origin, source_measurement_id)
    VALUES
      (m.order_id, lk.service_id, m.sample_id, 'open', m.priority, 'workflow', m.id);

    created := created + 1;
  END LOOP;

  RETURN created;
END;
$$;

-- 3) Explizite Zusatzbuchung einer bereits automatisch erzeugten Leistung
--    darf keine zweite Aufgabe entstehen lassen.
CREATE OR REPLACE FUNCTION public.trg_absorb_workflow_duplicate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sibling    public.order_measurements%ROWTYPE;
  has_progress boolean;
BEGIN
  IF NEW.origin NOT IN ('booked','package') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO sibling
  FROM public.order_measurements x
  WHERE x.order_id = NEW.order_id
    AND x.service_id = NEW.service_id
    AND x.sample_id IS NOT DISTINCT FROM NEW.sample_id
    AND x.id <> NEW.id
    AND x.origin = 'workflow'
  ORDER BY x.created_at
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  has_progress := sibling.status <> 'open'
    OR sibling.assigned_to IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.measurement_results r WHERE r.order_measurement_id = sibling.id);

  IF has_progress THEN
    -- bereits begonnene Workflow-Aufgabe wird zur gebuchten Leistung
    UPDATE public.order_measurements
      SET origin = NEW.origin,
          priority = NEW.priority
    WHERE id = sibling.id;
    DELETE FROM public.order_measurements WHERE id = NEW.id;
  ELSE
    -- leere Workflow-Aufgabe entfaellt, die gebuchte Leistung bleibt bestehen
    UPDATE public.order_measurements
      SET source_measurement_id = NULL
    WHERE source_measurement_id = sibling.id;
    DELETE FROM public.order_measurements WHERE id = sibling.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_absorb_workflow_duplicate() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_absorb_workflow_duplicate ON public.order_measurements;
CREATE TRIGGER trg_absorb_workflow_duplicate
AFTER INSERT ON public.order_measurements
FOR EACH ROW EXECUTE FUNCTION public.trg_absorb_workflow_duplicate();