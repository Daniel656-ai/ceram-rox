-- ============================================================
-- Phase 4: model-driven form architecture (purely additive)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.form_field_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_definition_id uuid NOT NULL REFERENCES public.form_definitions(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Neue Regel',
  is_active boolean NOT NULL DEFAULT true,
  condition jsonb NOT NULL DEFAULT '{"logic":"and","conditions":[]}'::jsonb,
  action text NOT NULL DEFAULT 'show',
  target_field_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_field_rules TO authenticated;
GRANT ALL ON public.form_field_rules TO service_role;
ALTER TABLE public.form_field_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "form_field_rules_read" ON public.form_field_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "form_field_rules_manage" ON public.form_field_rules
  FOR ALL TO authenticated
  USING (public.can_manage_designer(auth.uid()))
  WITH CHECK (public.can_manage_designer(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_form_field_rules_form ON public.form_field_rules(form_definition_id);

CREATE TRIGGER trg_form_field_rules_updated_at
  BEFORE UPDATE ON public.form_field_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.form_definition_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_definition_id uuid NOT NULL REFERENCES public.form_definitions(id) ON DELETE CASCADE,
  version integer NOT NULL,
  note text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (form_definition_id, version)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_definition_versions TO authenticated;
GRANT ALL ON public.form_definition_versions TO service_role;
ALTER TABLE public.form_definition_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "form_definition_versions_read" ON public.form_definition_versions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "form_definition_versions_manage" ON public.form_definition_versions
  FOR ALL TO authenticated
  USING (public.can_manage_designer(auth.uid()))
  WITH CHECK (public.can_manage_designer(auth.uid()));

CREATE TABLE IF NOT EXISTS public.order_form_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  form_definition_id uuid NOT NULL REFERENCES public.form_definitions(id) ON DELETE CASCADE,
  version integer NOT NULL,
  version_id uuid REFERENCES public.form_definition_versions(id) ON DELETE SET NULL,
  role_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, form_definition_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_form_versions TO authenticated;
GRANT ALL ON public.order_form_versions TO service_role;
ALTER TABLE public.order_form_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_form_versions_read" ON public.order_form_versions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "order_form_versions_insert" ON public.order_form_versions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "order_form_versions_update" ON public.order_form_versions
  FOR UPDATE TO authenticated
  USING (public.can_manage_designer(auth.uid()))
  WITH CHECK (public.can_manage_designer(auth.uid()));

CREATE TABLE IF NOT EXISTS public.form_value_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  form_definition_id uuid REFERENCES public.form_definitions(id) ON DELETE SET NULL,
  field_key text NOT NULL,
  field_label text,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid DEFAULT auth.uid(),
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.form_value_history TO authenticated;
GRANT ALL ON public.form_value_history TO service_role;
ALTER TABLE public.form_value_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "form_value_history_read" ON public.form_value_history
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "form_value_history_insert" ON public.form_value_history
  FOR INSERT TO authenticated WITH CHECK (changed_by = auth.uid() OR changed_by IS NULL);

CREATE INDEX IF NOT EXISTS idx_form_value_history_order ON public.form_value_history(order_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_form_value_history_field ON public.form_value_history(field_key);

ALTER TABLE public.global_fields
  ADD COLUMN IF NOT EXISTS reference_object_id uuid REFERENCES public.global_objects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reference_source text;

CREATE OR REPLACE FUNCTION public.global_field_usage(_field_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_object_key text;
  v_binding text;
  v_forms jsonb := '[]'::jsonb;
  v_reports jsonb := '[]'::jsonb;
  v_calcs jsonb := '[]'::jsonb;
  v_workflows jsonb := '[]'::jsonb;
BEGIN
  SELECT gf.field_key, go.object_key INTO v_key, v_object_key
  FROM public.global_fields gf
  JOIN public.global_objects go ON go.id = gf.object_id
  WHERE gf.id = _field_id;

  IF v_key IS NULL THEN
    RETURN jsonb_build_object('forms','[]'::jsonb,'reports','[]'::jsonb,'calculations','[]'::jsonb,'workflows','[]'::jsonb);
  END IF;

  v_binding := v_object_key || '.' || v_key;

  SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', fd.id, 'name', fd.name)), '[]'::jsonb)
  INTO v_forms
  FROM public.form_fields ff
  JOIN public.form_definitions fd ON fd.id = ff.form_id
  WHERE ff.global_field_id = _field_id OR ff.binding_path = v_binding;

  SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', pt.id, 'name', pt.name)), '[]'::jsonb)
  INTO v_reports
  FROM public.process_templates pt
  WHERE pt.metadata::text LIKE '%' || v_binding || '%';

  SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', gc.id, 'name', gc.display_name)), '[]'::jsonb)
  INTO v_calcs
  FROM public.global_calculations gc
  WHERE gc.formula LIKE '%' || v_key || '%';

  SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', wt.id, 'name', wt.name)), '[]'::jsonb)
  INTO v_workflows
  FROM public.workflow_templates wt
  JOIN public.workflow_template_steps wts ON wts.template_id = wt.id
  WHERE wts.form_id IN (
    SELECT ff.form_id FROM public.form_fields ff
    WHERE ff.global_field_id = _field_id OR ff.binding_path = v_binding
  );

  RETURN jsonb_build_object(
    'binding_path', v_binding,
    'forms', v_forms,
    'reports', v_reports,
    'calculations', v_calcs,
    'workflows', v_workflows
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.global_field_usage(uuid) TO authenticated;