
-- =========================================================================
-- TEMPLATE LINKS
-- =========================================================================

-- Form ↔ Service
CREATE TABLE public.service_form_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.measurement_services(id) ON DELETE CASCADE,
  form_definition_id uuid NOT NULL REFERENCES public.form_definitions(id) ON DELETE RESTRICT,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(service_id, form_definition_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_form_links TO authenticated;
GRANT ALL ON public.service_form_links TO service_role;
ALTER TABLE public.service_form_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sfl select" ON public.service_form_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "sfl manage" ON public.service_form_links FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'admin.system'))
  WITH CHECK (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'admin.system'));
CREATE TRIGGER trg_sfl_updated_at BEFORE UPDATE ON public.service_form_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Service ↔ Process
CREATE TABLE public.process_service_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_template_id uuid NOT NULL REFERENCES public.process_templates(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.measurement_services(id) ON DELETE RESTRICT,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(process_template_id, service_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.process_service_links TO authenticated;
GRANT ALL ON public.process_service_links TO service_role;
ALTER TABLE public.process_service_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "psl select" ON public.process_service_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "psl manage" ON public.process_service_links FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'admin.system'))
  WITH CHECK (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'admin.system'));
CREATE TRIGGER trg_psl_updated_at BEFORE UPDATE ON public.process_service_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Process ↔ Workflow
CREATE TABLE public.workflow_process_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_template_id uuid NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  process_template_id uuid NOT NULL REFERENCES public.process_templates(id) ON DELETE RESTRICT,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workflow_template_id, process_template_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_process_links TO authenticated;
GRANT ALL ON public.workflow_process_links TO service_role;
ALTER TABLE public.workflow_process_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wpl select" ON public.workflow_process_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "wpl manage" ON public.workflow_process_links FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'admin.system'))
  WITH CHECK (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'admin.system'));
CREATE TRIGGER trg_wpl_updated_at BEFORE UPDATE ON public.workflow_process_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- ORDER INSTANCES (Snapshots)
-- =========================================================================

CREATE TABLE public.order_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.measurement_orders(id) ON DELETE CASCADE,
  process_template_id uuid REFERENCES public.process_templates(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','skipped')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_processes TO authenticated;
GRANT ALL ON public.order_processes TO service_role;
ALTER TABLE public.order_processes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op select" ON public.order_processes FOR SELECT TO authenticated USING (true);
CREATE POLICY "op insert" ON public.order_processes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "op update" ON public.order_processes FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "op delete" ON public.order_processes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'admin.system'));
CREATE TRIGGER trg_op_updated_at BEFORE UPDATE ON public.order_processes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_op_order ON public.order_processes(order_id);

CREATE TABLE public.order_process_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_process_id uuid NOT NULL REFERENCES public.order_processes(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.measurement_services(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','skipped')),
  assigned_role text,
  assigned_to uuid,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_process_services TO authenticated;
GRANT ALL ON public.order_process_services TO service_role;
ALTER TABLE public.order_process_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops select" ON public.order_process_services FOR SELECT TO authenticated USING (true);
CREATE POLICY "ops insert" ON public.order_process_services FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ops update" ON public.order_process_services FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ops delete" ON public.order_process_services FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'admin.system'));
CREATE TRIGGER trg_ops_updated_at BEFORE UPDATE ON public.order_process_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_ops_process ON public.order_process_services(order_process_id);

CREATE TABLE public.order_service_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_process_service_id uuid NOT NULL REFERENCES public.order_process_services(id) ON DELETE CASCADE,
  form_definition_id uuid REFERENCES public.form_definitions(id) ON DELETE SET NULL,
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  role_view_key text,
  response_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','skipped')),
  completed_by uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_service_forms TO authenticated;
GRANT ALL ON public.order_service_forms TO service_role;
ALTER TABLE public.order_service_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "osf select" ON public.order_service_forms FOR SELECT TO authenticated USING (true);
CREATE POLICY "osf insert" ON public.order_service_forms FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "osf update" ON public.order_service_forms FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "osf delete" ON public.order_service_forms FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'admin.system'));
CREATE TRIGGER trg_osf_updated_at BEFORE UPDATE ON public.order_service_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_osf_service ON public.order_service_forms(order_process_service_id);

-- =========================================================================
-- RPC: create order workflow instance from selected process templates
-- =========================================================================
CREATE OR REPLACE FUNCTION public.create_order_workflow_instance(
  _order_id uuid,
  _process_template_ids uuid[]
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pt_id uuid;
  _op_id uuid;
  _ops_id uuid;
  _process_row record;
  _service_row record;
  _form_row record;
  _created_process_ids uuid[] := ARRAY[]::uuid[];
  _p_idx int := 0;
  _s_idx int;
  _f_idx int;
BEGIN
  IF _order_id IS NULL OR _process_template_ids IS NULL THEN
    RETURN _created_process_ids;
  END IF;

  FOREACH _pt_id IN ARRAY _process_template_ids LOOP
    SELECT id, name, description INTO _process_row FROM public.process_templates WHERE id = _pt_id;
    IF NOT FOUND THEN CONTINUE; END IF;

    _p_idx := _p_idx + 1;
    INSERT INTO public.order_processes (order_id, process_template_id, name, description, order_index)
    VALUES (_order_id, _pt_id, _process_row.name, _process_row.description, _p_idx)
    RETURNING id INTO _op_id;
    _created_process_ids := array_append(_created_process_ids, _op_id);

    _s_idx := 0;
    FOR _service_row IN
      SELECT psl.service_id, psl.order_index, ms.service_name, ms.description AS svc_desc
      FROM public.process_service_links psl
      JOIN public.measurement_services ms ON ms.id = psl.service_id
      WHERE psl.process_template_id = _pt_id
      ORDER BY psl.order_index, ms.service_name
    LOOP
      _s_idx := _s_idx + 1;
      INSERT INTO public.order_process_services (order_process_id, service_id, name, description, order_index)
      VALUES (_op_id, _service_row.service_id, _service_row.service_name, _service_row.svc_desc, _s_idx)
      RETURNING id INTO _ops_id;

      _f_idx := 0;
      FOR _form_row IN
        SELECT sfl.form_definition_id, sfl.order_index, fd.name AS form_name
        FROM public.service_form_links sfl
        JOIN public.form_definitions fd ON fd.id = sfl.form_definition_id
        WHERE sfl.service_id = _service_row.service_id
        ORDER BY sfl.order_index, fd.name
      LOOP
        _f_idx := _f_idx + 1;
        INSERT INTO public.order_service_forms (order_process_service_id, form_definition_id, name, order_index)
        VALUES (_ops_id, _form_row.form_definition_id, _form_row.form_name, _f_idx);
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN _created_process_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_workflow_instance(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_workflow_instance(uuid, uuid[]) TO authenticated, service_role;
