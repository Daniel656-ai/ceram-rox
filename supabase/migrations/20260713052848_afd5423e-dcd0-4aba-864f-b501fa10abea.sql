
-- =========================================================
-- Phase A2: Sequenzfunktion + Bootstrap-Trigger
-- =========================================================

-- 1) Sequenzfunktion (advisory-locked, sicher gegen Race Conditions)
CREATE OR REPLACE FUNCTION public.next_reference_number(
  p_origin text,
  p_reference_type public.reference_type
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int := EXTRACT(year FROM now())::int;
  v_seq int;
  v_pattern text;
  v_result text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('refseq:' || p_origin || ':' || p_reference_type::text || ':' || v_year));

  INSERT INTO public.reference_number_sequences (origin, reference_type, year, next_seq, pattern)
  VALUES (p_origin, p_reference_type, v_year, 1, 'V{yy}-{seq:03}')
  ON CONFLICT (origin, reference_type, year) DO NOTHING;

  UPDATE public.reference_number_sequences
     SET next_seq = next_seq + 1, updated_at = now()
   WHERE origin = p_origin AND reference_type = p_reference_type AND year = v_year
   RETURNING next_seq - 1, pattern INTO v_seq, v_pattern;

  v_result := v_pattern;
  v_result := replace(v_result, '{yy}',  to_char(v_year % 100, 'FM00'));
  v_result := replace(v_result, '{yyyy}', v_year::text);
  v_result := replace(v_result, '{seq:03}', to_char(v_seq, 'FM000'));
  v_result := replace(v_result, '{seq:04}', to_char(v_seq, 'FM0000'));
  v_result := replace(v_result, '{seq:05}', to_char(v_seq, 'FM00000'));
  v_result := replace(v_result, '{seq}',   v_seq::text);
  RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION public.next_reference_number(text, public.reference_type) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_reference_number(text, public.reference_type) TO authenticated, service_role;

-- 2) Vorlage anhand Auftrag ermitteln
CREATE OR REPLACE FUNCTION public.resolve_workflow_template(
  p_order_id uuid
) RETURNS TABLE(template_id uuid, requires_kneading boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origin text;
BEGIN
  SELECT origin INTO v_origin FROM public.measurement_orders WHERE id = p_order_id;

  -- (a) Servicepaket-Mapping
  RETURN QUERY
  SELECT m.template_id, m.requires_kneading
  FROM public.order_analysis_requests r
  JOIN public.measurement_services s ON s.id = r.service_id
  JOIN public.service_package_items pi ON pi.service_id = s.id
  JOIN public.service_package_workflow_map m ON m.package_id = pi.package_id
  WHERE r.order_id = p_order_id
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- (b) Origin-Default
  RETURN QUERY
  SELECT o.default_workflow_template_id, false
  FROM public.work_object_origins o
  WHERE o.key = v_origin AND o.default_workflow_template_id IS NOT NULL
  LIMIT 1;
END $$;

REVOKE ALL ON FUNCTION public.resolve_workflow_template(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_workflow_template(uuid) TO authenticated, service_role;

-- 3) Bootstrap-Funktion
CREATE OR REPLACE FUNCTION public.bootstrap_order_workflow(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_template_id uuid;
  v_requires_kneading boolean;
  v_instance_id uuid;
  v_first_task_role text;
  v_first_step_id uuid;
BEGIN
  SELECT * INTO v_order FROM public.measurement_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Referenznummer generieren, falls fehlt
  IF v_order.reference_number IS NULL OR v_order.reference_number = '' THEN
    UPDATE public.measurement_orders
       SET reference_number = public.next_reference_number(
             COALESCE(v_order.origin, 'pilot_plant'),
             COALESCE(v_order.reference_type, 'experiment'::public.reference_type)
           )
     WHERE id = p_order_id;
  END IF;

  -- Existiert bereits eine Instanz? Dann Abbruch.
  IF EXISTS (SELECT 1 FROM public.order_workflow_instances WHERE order_id = p_order_id) THEN
    RETURN;
  END IF;

  -- Template ermitteln
  SELECT template_id, requires_kneading INTO v_template_id, v_requires_kneading
  FROM public.resolve_workflow_template(p_order_id);

  IF v_template_id IS NULL THEN
    RETURN; -- kein Template, Bootstrap-Ende
  END IF;

  -- Auftrags-spezifische Workflow-Definition + Steps klonen
  INSERT INTO public.service_workflow_definitions (service_id, name, version, is_active, graph)
  VALUES (
    COALESCE((SELECT service_id FROM public.order_analysis_requests WHERE order_id = p_order_id LIMIT 1),
             '00000000-0000-0000-0000-000000000000'::uuid),
    (SELECT name FROM public.workflow_templates WHERE id = v_template_id),
    1, true, '{}'::jsonb
  ) RETURNING id INTO v_instance_id;

  INSERT INTO public.service_workflow_steps
    (workflow_id, step_key, name, description, step_type, role_required, form_id,
     is_mandatory, order_index, condition_expr, due_hours)
  SELECT v_instance_id, s.step_key, s.name, s.description, s.step_type, s.role_required, s.form_id,
         s.is_mandatory, s.order_index, s.condition_expr, s.due_hours
  FROM public.workflow_template_steps s
  WHERE s.template_id = v_template_id
    AND (v_requires_kneading OR s.step_key NOT IN ('weighing','kneading'))
  ORDER BY s.order_index;

  -- Instanz für Auftrag anlegen
  INSERT INTO public.order_workflow_instances (order_id, workflow_id, workflow_version, status, started_at)
  VALUES (p_order_id, v_instance_id, 1, 'active', now())
  RETURNING id INTO v_instance_id;

  -- Ersten Step ermitteln
  SELECT id, role_required INTO v_first_step_id, v_first_task_role
  FROM public.service_workflow_steps
  WHERE workflow_id = (SELECT workflow_id FROM public.order_workflow_instances WHERE id = v_instance_id)
  ORDER BY order_index LIMIT 1;

  -- Tasks für ALLE Steps anlegen (erster pending, Rest auch pending)
  INSERT INTO public.order_workflow_tasks
    (instance_id, step_id, order_id, form_id, assigned_role, status, priority)
  SELECT v_instance_id, s.id, p_order_id, s.form_id, s.role_required,
         CASE WHEN s.id = v_first_step_id THEN 'pending' ELSE 'pending' END,
         'normal'
  FROM public.service_workflow_steps s
  WHERE s.workflow_id = (SELECT workflow_id FROM public.order_workflow_instances WHERE id = v_instance_id)
  ORDER BY s.order_index;

  -- current_step_id setzen
  UPDATE public.order_workflow_instances
     SET current_step_id = v_first_step_id
   WHERE id = v_instance_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'bootstrap_order_workflow failed for %: %', p_order_id, SQLERRM;
END $$;

REVOKE ALL ON FUNCTION public.bootstrap_order_workflow(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_order_workflow(uuid) TO authenticated, service_role;

-- 4) Trigger
CREATE OR REPLACE FUNCTION public.tg_bootstrap_workflow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.bootstrap_order_workflow(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bootstrap_workflow ON public.measurement_orders;
CREATE TRIGGER trg_bootstrap_workflow
  AFTER INSERT ON public.measurement_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_bootstrap_workflow();

-- 5) Backfill: bestehende Aufträge ohne Instanz
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT o.id
    FROM public.measurement_orders o
    LEFT JOIN public.order_workflow_instances i ON i.order_id = o.id
    WHERE i.id IS NULL
  LOOP
    PERFORM public.bootstrap_order_workflow(r.id);
  END LOOP;
END $$;
