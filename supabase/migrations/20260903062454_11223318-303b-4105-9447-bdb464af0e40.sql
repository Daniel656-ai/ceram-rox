-- 1) Konfiguration: NOx-Dienstleistung an ihre Prozessvorlage binden
UPDATE public.measurement_services
   SET process_template_id = '36e6dc84-3d02-44dc-ac95-8707f4024a62'
 WHERE id = '13e43ee9-efc3-497e-b106-4970d3c9e07f'
   AND process_template_id IS DISTINCT FROM '36e6dc84-3d02-44dc-ac95-8707f4024a62';

-- 2) Vorlagenschritte den Dienstleistungen zuordnen
UPDATE public.process_steps
   SET step_kind = 'service', service_id = 'aad51ee2-9295-4eb3-9f87-5a78f6352fec'
 WHERE template_id = '36e6dc84-3d02-44dc-ac95-8707f4024a62'
   AND step_key = 'Geometrievermessung';

UPDATE public.process_steps
   SET step_kind = 'service', service_id = '13e43ee9-efc3-497e-b106-4970d3c9e07f'
 WHERE template_id = '36e6dc84-3d02-44dc-ac95-8707f4024a62'
   AND step_key = 'NOx';

-- 3) Expansion robuster: Schritte UND hinterlegte Dienstleistungen der Vorlage
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
  own_step    RECORD;
  created     integer := 0;
BEGIN
  SELECT * INTO m FROM public.order_measurements WHERE id = _measurement_id;
  IF NOT FOUND OR m.service_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT process_template_id INTO tpl_id
  FROM public.measurement_services WHERE id = m.service_id;

  IF tpl_id IS NULL THEN
    RETURN 0;
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

  -- a) Vorgelagerte Dienstleistungsschritte
  FOR st IN
    SELECT * FROM public.process_steps
    WHERE template_id = tpl_id
      AND step_kind = 'service'
      AND service_id IS NOT NULL
      AND service_id <> m.service_id
      AND (own_step.id IS NULL OR order_index < own_step.order_index)
    ORDER BY order_index
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.order_measurements x
      WHERE x.order_id = m.order_id
        AND x.service_id = st.service_id
        AND x.sample_id IS NOT DISTINCT FROM m.sample_id
    ) THEN
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

  -- b) In der Vorlage hinterlegte Dienstleistungen (process_service_links)
  FOR lk IN
    SELECT l.service_id, l.order_index
    FROM public.process_service_links l
    WHERE l.process_template_id = tpl_id
      AND l.service_id IS NOT NULL
      AND l.service_id <> m.service_id
    ORDER BY l.order_index
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.order_measurements x
      WHERE x.order_id = m.order_id
        AND x.service_id = lk.service_id
        AND x.sample_id IS NOT DISTINCT FROM m.sample_id
    ) THEN
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

REVOKE ALL ON FUNCTION public.expand_service_workflow(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expand_service_workflow(uuid) TO authenticated, service_role;

-- 4) Auch bei nachtraeglicher Aenderung der Dienstleistung expandieren
CREATE OR REPLACE FUNCTION public.trg_expand_service_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.origin IN ('booked','package') THEN
      PERFORM public.expand_service_workflow(NEW.id);
    END IF;
  ELSIF NEW.service_id IS DISTINCT FROM OLD.service_id
        AND NEW.origin IN ('booked','package') THEN
    PERFORM public.expand_service_workflow(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_expand_service_workflow() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS order_measurements_expand_workflow ON public.order_measurements;
CREATE TRIGGER order_measurements_expand_workflow
AFTER INSERT ON public.order_measurements
FOR EACH ROW EXECUTE FUNCTION public.trg_expand_service_workflow();

DROP TRIGGER IF EXISTS order_measurements_expand_workflow_upd ON public.order_measurements;
CREATE TRIGGER order_measurements_expand_workflow_upd
AFTER UPDATE OF service_id ON public.order_measurements
FOR EACH ROW EXECUTE FUNCTION public.trg_expand_service_workflow();

-- 5) Bestehende offene NOx-Aufgaben einmalig nachziehen
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.order_measurements
    WHERE service_id = '13e43ee9-efc3-497e-b106-4970d3c9e07f'
      AND status <> 'completed'
  LOOP
    PERFORM public.expand_service_workflow(r.id);
  END LOOP;
END $$;