CREATE TABLE IF NOT EXISTS public.service_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.measurement_services(id) ON DELETE CASCADE,
  requires_service_id uuid NOT NULL REFERENCES public.measurement_services(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_dependencies_unique UNIQUE (service_id, requires_service_id),
  CONSTRAINT service_dependencies_no_self CHECK (service_id <> requires_service_id)
);

GRANT SELECT ON public.service_dependencies TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.service_dependencies TO authenticated;
GRANT ALL ON public.service_dependencies TO service_role;

ALTER TABLE public.service_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_dependencies_select" ON public.service_dependencies
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "service_dependencies_manage" ON public.service_dependencies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

CREATE TRIGGER service_dependencies_updated_at
BEFORE UPDATE ON public.service_dependencies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Expansion: zuerst direkte Dienstleistungsabhaengigkeiten, danach Prozessvorlagen
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
  created     integer := 0;
BEGIN
  SELECT * INTO m FROM public.order_measurements WHERE id = _measurement_id;
  IF NOT FOUND OR m.service_id IS NULL THEN
    RETURN 0;
  END IF;

  -- 0) Direkte, formularunabhaengige Dienstleistungsabhaengigkeiten
  FOR dep IN
    SELECT d.requires_service_id, d.order_index
    FROM public.service_dependencies d
    WHERE d.service_id = m.service_id
      AND d.requires_service_id <> m.service_id
    ORDER BY d.order_index
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.order_measurements x
      WHERE x.order_id = m.order_id
        AND x.service_id = dep.requires_service_id
        AND x.sample_id IS NOT DISTINCT FROM m.sample_id
    ) THEN
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

-- Idempotente Nachexpansion fuer einen kompletten Auftrag
CREATE OR REPLACE FUNCTION public.expand_order_workflows(_order_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r       RECORD;
  created integer := 0;
BEGIN
  FOR r IN
    SELECT id FROM public.order_measurements
    WHERE order_id = _order_id
      AND origin IN ('booked','package')
      AND status <> 'completed'
  LOOP
    created := created + public.expand_service_workflow(r.id);
  END LOOP;
  RETURN created;
END;
$$;

REVOKE ALL ON FUNCTION public.expand_order_workflows(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expand_order_workflows(uuid) TO authenticated, service_role;

-- Konfiguration: NOX-Messung benoetigt Geometrievermessung
INSERT INTO public.service_dependencies (service_id, requires_service_id, order_index, note)
VALUES ('13e43ee9-efc3-497e-b106-4970d3c9e07f', 'aad51ee2-9295-4eb3-9f87-5a78f6352fec', 0, 'Geometriewerte werden fuer die NOx-Auswertung benoetigt')
ON CONFLICT (service_id, requires_service_id) DO NOTHING;