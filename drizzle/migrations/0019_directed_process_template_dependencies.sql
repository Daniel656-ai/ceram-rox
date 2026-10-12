CREATE OR REPLACE FUNCTION public.expand_service_workflow(_measurement_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Gerichtet: Nur die übergeordnete Dienstleistung (selbst NICHT Teil der
  -- verknüpften Leistungen ihrer Vorlage) ergänzt die Teilleistungen.
  IF NOT EXISTS (
    SELECT 1 FROM public.process_service_links l0
    WHERE l0.process_template_id = tpl_id AND l0.service_id = m.service_id
  ) THEN
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
  END IF;

  RETURN created;
END;
$function$;

CREATE OR REPLACE FUNCTION public.service_required_services(_service_id uuid)
 RETURNS TABLE(service_id uuid, service_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH RECURSIVE direct AS (
    SELECT d.service_id AS src, d.requires_service_id AS req
    FROM public.service_dependencies d
    UNION ALL
    SELECT ps_own.service_id, ps.service_id
    FROM public.process_steps ps
    JOIN public.process_steps ps_own
      ON ps_own.template_id = ps.template_id
     AND ps_own.step_kind = 'service'
     AND ps.order_index < ps_own.order_index
    WHERE ps.step_kind = 'service'
      AND ps.service_id IS NOT NULL
      AND ps_own.service_id IS NOT NULL
      AND ps.service_id <> ps_own.service_id
    UNION ALL
    SELECT s.id, l.service_id
    FROM public.measurement_services s
    JOIN public.process_service_links l ON l.process_template_id = s.process_template_id
    WHERE l.service_id IS NOT NULL AND l.service_id <> s.id
      AND NOT EXISTS (
        SELECT 1 FROM public.process_service_links l0
        WHERE l0.process_template_id = s.process_template_id AND l0.service_id = s.id
      )
  ),
  walk AS (
    SELECT d.req AS id, 1 AS depth
    FROM direct d
    WHERE d.src = _service_id
    UNION
    SELECT d.req, w.depth + 1
    FROM walk w
    JOIN direct d ON d.src = w.id
    WHERE w.depth < 5 AND d.req <> _service_id
  )
  SELECT DISTINCT ms.id, ms.service_name
  FROM walk w
  JOIN public.measurement_services ms ON ms.id = w.id
  WHERE ms.id <> _service_id;
$function$;