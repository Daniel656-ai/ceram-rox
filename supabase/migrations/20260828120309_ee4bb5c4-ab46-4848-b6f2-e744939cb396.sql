-- Abhaengigkeiten auf Aufgabenebene
ALTER TABLE public.order_measurements
  ADD COLUMN IF NOT EXISTS depends_on_step_keys text[] NOT NULL DEFAULT '{}';

-- Erzeugt aus dem Workflow einer Dienstleistung die benoetigten weiteren Aufgaben
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

  -- Eigener Schritt im Workflow (die gebuchte Leistung selbst)
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

  -- Vorgelagerte Dienstleistungsschritte automatisch erzeugen
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

  RETURN created;
END;
$$;

REVOKE ALL ON FUNCTION public.expand_service_workflow(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expand_service_workflow(uuid) TO authenticated, service_role;

-- Trigger: direkt gebuchte bzw. ueber Paket erzeugte Aufgaben expandieren
CREATE OR REPLACE FUNCTION public.trg_expand_service_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.origin IN ('booked','package') THEN
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

-- Startbereitschaft einer Aufgabe anhand ihrer Vorgaenger
CREATE OR REPLACE FUNCTION public.measurement_is_ready(_measurement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.order_measurements m
    JOIN public.order_measurements dep
      ON dep.order_id = m.order_id
     AND dep.sample_id IS NOT DISTINCT FROM m.sample_id
     AND dep.source_step_key = ANY (m.depends_on_step_keys)
    WHERE m.id = _measurement_id
      AND dep.status <> 'completed'
  );
$$;

REVOKE ALL ON FUNCTION public.measurement_is_ready(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.measurement_is_ready(uuid) TO authenticated, service_role;