
-- Helper: deep copy a form_definition (and its fields) and return new form id
CREATE OR REPLACE FUNCTION public._clone_form_definition(_source_form_id uuid, _new_scope text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_form_id uuid;
  _src record;
BEGIN
  SELECT * INTO _src FROM public.form_definitions WHERE id = _source_form_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  INSERT INTO public.form_definitions (name, description, scope, version, layout, created_by)
  VALUES (_src.name, _src.description, COALESCE(_new_scope::form_scope, _src.scope), 1, _src.layout, auth.uid())
  RETURNING id INTO _new_form_id;

  INSERT INTO public.form_fields (
    form_id, field_key, display_name, description, field_type, category, unit,
    is_required, default_value, validation, min_value, max_value, decimal_places,
    readonly, formula, select_options, ref_target, parent_field_id, sort_order, metadata
  )
  SELECT
    _new_form_id, field_key, display_name, description, field_type, category, unit,
    is_required, default_value, validation, min_value, max_value, decimal_places,
    readonly, formula, select_options, ref_target, parent_field_id, sort_order, metadata
  FROM public.form_fields
  WHERE form_id = _source_form_id;

  RETURN _new_form_id;
END;
$$;

-- Insert snippet steps (with cloned forms) into target template at end
CREATE OR REPLACE FUNCTION public.insert_snippet_into_template(
  _target_template_id uuid,
  _snippet_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _base_index integer;
  _step record;
  _new_form_id uuid;
  _count integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'master') THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  SELECT COALESCE(MAX(order_index), -1) INTO _base_index
    FROM public.process_steps WHERE template_id = _target_template_id;

  FOR _step IN
    SELECT * FROM public.process_steps WHERE template_id = _snippet_id ORDER BY order_index
  LOOP
    _new_form_id := NULL;
    IF _step.form_id IS NOT NULL THEN
      _new_form_id := public._clone_form_definition(_step.form_id, 'template');
    END IF;

    INSERT INTO public.process_steps (
      template_id, step_key, name, description, order_index, form_id, role_required,
      assignee_rule, is_mandatory, condition_expr, auto_actions, due_hours, escalation_role,
      position_source, metadata
    ) VALUES (
      _target_template_id,
      _step.step_key || '_' || substr(md5(random()::text), 1, 4),
      _step.name, _step.description,
      _base_index + 1 + _count,
      _new_form_id, _step.role_required,
      _step.assignee_rule, _step.is_mandatory, _step.condition_expr, _step.auto_actions,
      _step.due_hours, _step.escalation_role, _step.position_source,
      COALESCE(_step.metadata, '{}'::jsonb) || jsonb_build_object('from_snippet', _snippet_id)
    );
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

-- Clone a template as a new version (deep copy of steps + forms + fields)
CREATE OR REPLACE FUNCTION public.clone_template_as_new_version(_template_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _src record;
  _new_id uuid;
  _step record;
  _new_form_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'master') THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  SELECT * INTO _src FROM public.process_templates WHERE id = _template_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'template_not_found'; END IF;

  INSERT INTO public.process_templates (
    name, description, kind, scope, category, version, is_active, metadata, created_by
  ) VALUES (
    _src.name, _src.description, _src.kind, _src.scope, _src.category,
    _src.version + 1, true, COALESCE(_src.metadata, '{}'::jsonb) || jsonb_build_object('cloned_from', _src.id),
    auth.uid()
  ) RETURNING id INTO _new_id;

  -- deactivate old version
  UPDATE public.process_templates SET is_active = false WHERE id = _src.id;

  FOR _step IN
    SELECT * FROM public.process_steps WHERE template_id = _template_id ORDER BY order_index
  LOOP
    _new_form_id := NULL;
    IF _step.form_id IS NOT NULL THEN
      _new_form_id := public._clone_form_definition(_step.form_id, 'template');
    END IF;

    INSERT INTO public.process_steps (
      template_id, step_key, name, description, order_index, form_id, role_required,
      assignee_rule, is_mandatory, condition_expr, auto_actions, due_hours, escalation_role,
      position_source, metadata
    ) VALUES (
      _new_id, _step.step_key, _step.name, _step.description, _step.order_index,
      _new_form_id, _step.role_required,
      _step.assignee_rule, _step.is_mandatory, _step.condition_expr, _step.auto_actions,
      _step.due_hours, _step.escalation_role, _step.position_source, _step.metadata
    );
  END LOOP;

  RETURN _new_id;
END;
$$;

-- Snapshot a template into JSON (for order_instances.template_snapshot)
CREATE OR REPLACE FUNCTION public.snapshot_template(_template_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'template', to_jsonb(t.*),
    'steps', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(s.*) || jsonb_build_object(
          'form', CASE WHEN s.form_id IS NULL THEN NULL ELSE (
            SELECT to_jsonb(f.*) || jsonb_build_object(
              'fields', COALESCE((SELECT jsonb_agg(to_jsonb(ff.*) ORDER BY ff.sort_order) FROM public.form_fields ff WHERE ff.form_id = f.id), '[]'::jsonb)
            )
            FROM public.form_definitions f WHERE f.id = s.form_id
          ) END
        ) ORDER BY s.order_index
      )
      FROM public.process_steps s WHERE s.template_id = t.id
    ), '[]'::jsonb)
  )
  FROM public.process_templates t WHERE t.id = _template_id;
$$;

GRANT EXECUTE ON FUNCTION public.insert_snippet_into_template(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clone_template_as_new_version(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snapshot_template(uuid) TO authenticated;
