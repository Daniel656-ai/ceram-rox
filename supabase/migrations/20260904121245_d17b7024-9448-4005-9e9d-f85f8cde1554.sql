CREATE OR REPLACE FUNCTION public.clone_global_form(_source_form_id uuid, _new_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _src public.form_definitions%ROWTYPE;
  _new_id uuid;
  _name text := btrim(coalesce(_new_name, ''));
  _map jsonb := '{}'::jsonb;
  _old text;
  _new text;
BEGIN
  IF NOT public.can_manage_designer(auth.uid()) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Kopieren von Formularen';
  END IF;

  IF _name = '' THEN
    RAISE EXCEPTION 'Bitte eine Bezeichnung für die Kopie angeben';
  END IF;

  SELECT * INTO _src FROM public.form_definitions WHERE id = _source_form_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Formular nicht gefunden';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.form_definitions
    WHERE scope = _src.scope AND archived_at IS NULL AND lower(btrim(name)) = lower(_name)
  ) THEN
    RAISE EXCEPTION 'Ein Formular mit der Bezeichnung "%" existiert bereits', _name;
  END IF;

  INSERT INTO public.form_definitions (name, description, scope, version, layout, created_by)
  VALUES (_name, _src.description, _src.scope, 1, _src.layout, auth.uid())
  RETURNING id INTO _new_id;

  FOR _old, _new IN
    WITH ins AS (
      INSERT INTO public.form_fields (
        form_id, field_key, display_name, description, field_type, category, unit,
        is_required, default_value, validation, min_value, max_value, decimal_places,
        readonly, formula, select_options, ref_target, parent_field_id, sort_order, metadata,
        binding_path, data_source, global_field_id, is_result, result_label
      )
      SELECT
        _new_id, f.field_key, f.display_name, f.description, f.field_type, f.category, f.unit,
        f.is_required, f.default_value, f.validation, f.min_value, f.max_value, f.decimal_places,
        f.readonly, f.formula, f.select_options, f.ref_target, f.parent_field_id, f.sort_order, f.metadata,
        f.binding_path, f.data_source, f.global_field_id, f.is_result, f.result_label
      FROM public.form_fields f
      WHERE f.form_id = _source_form_id
      RETURNING id, field_key
    )
    SELECT src.id::text, ins.id::text
    FROM ins
    JOIN public.form_fields src ON src.form_id = _source_form_id AND src.field_key = ins.field_key
  LOOP
    _map := _map || jsonb_build_object(_old, _new);
  END LOOP;

  FOR _old, _new IN
    WITH ins AS (
      INSERT INTO public.form_calculations (
        form_id, calc_key, display_name, description, formula, expression, inputs,
        unit, decimals, rounding, result_type, sort_order, is_result, result_label, created_by
      )
      SELECT
        _new_id, c.calc_key, c.display_name, c.description, c.formula, c.expression, c.inputs,
        c.unit, c.decimals, c.rounding, c.result_type, c.sort_order, c.is_result, c.result_label, auth.uid()
      FROM public.form_calculations c
      WHERE c.form_id = _source_form_id
      RETURNING id, calc_key
    )
    SELECT src.id::text, ins.id::text
    FROM ins
    JOIN public.form_calculations src ON src.form_id = _source_form_id AND src.calc_key = ins.calc_key
  LOOP
    _map := _map || jsonb_build_object(_old, _new);
  END LOOP;

  INSERT INTO public.form_role_views (form_definition_id, role_key, label, layout, created_by, updated_by)
  SELECT _new_id, v.role_key, v.label, v.layout, auth.uid(), auth.uid()
  FROM public.form_role_views v
  WHERE v.form_definition_id = _source_form_id;

  INSERT INTO public.form_field_rules (form_definition_id, name, condition, action, target_field_ids, is_active, sort_order, created_by)
  SELECT _new_id, r.name, r.condition, r.action, r.target_field_ids, r.is_active, r.sort_order, auth.uid()
  FROM public.form_field_rules r
  WHERE r.form_definition_id = _source_form_id;

  INSERT INTO public.form_field_permissions (form_definition_id, role_key, field_id, visibility, required, can_add, can_remove)
  SELECT _new_id, p.role_key, p.field_id, p.visibility, p.required, p.can_add, p.can_remove
  FROM public.form_field_permissions p
  WHERE p.form_definition_id = _source_form_id;

  FOR _old, _new IN SELECT key, value #>> '{}' FROM jsonb_each(_map) LOOP
    UPDATE public.form_definitions
      SET layout = replace(layout::text, _old, _new)::jsonb
      WHERE id = _new_id AND layout::text LIKE '%' || _old || '%';

    UPDATE public.form_role_views
      SET layout = replace(layout::text, _old, _new)::jsonb
      WHERE form_definition_id = _new_id AND layout::text LIKE '%' || _old || '%';

    UPDATE public.form_fields
      SET metadata = replace(metadata::text, _old, _new)::jsonb,
          data_source = replace(data_source::text, _old, _new)::jsonb,
          validation = replace(validation::text, _old, _new)::jsonb,
          select_options = replace(select_options::text, _old, _new)::jsonb
      WHERE form_id = _new_id
        AND (metadata::text || data_source::text || validation::text || select_options::text) LIKE '%' || _old || '%';

    UPDATE public.form_calculations
      SET expression = replace(expression::text, _old, _new)::jsonb,
          inputs = replace(inputs::text, _old, _new)::jsonb,
          formula = replace(formula, _old, _new)
      WHERE form_id = _new_id
        AND (expression::text || inputs::text || coalesce(formula, '')) LIKE '%' || _old || '%';

    UPDATE public.form_field_rules
      SET condition = replace(condition::text, _old, _new)::jsonb,
          target_field_ids = (
            SELECT array_agg(CASE WHEN t::text = _old THEN _new::uuid ELSE t END ORDER BY ord)
            FROM unnest(target_field_ids) WITH ORDINALITY AS u(t, ord)
          )
      WHERE form_definition_id = _new_id;

    UPDATE public.form_field_permissions
      SET field_id = _new::uuid
      WHERE form_definition_id = _new_id AND field_id = _old::uuid;
  END LOOP;

  UPDATE public.form_fields nf
    SET parent_field_id = (_map ->> nf.parent_field_id::text)::uuid
    WHERE nf.form_id = _new_id
      AND nf.parent_field_id IS NOT NULL
      AND _map ? nf.parent_field_id::text;

  RETURN _new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.clone_global_form(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clone_global_form(uuid, text) TO authenticated, service_role;