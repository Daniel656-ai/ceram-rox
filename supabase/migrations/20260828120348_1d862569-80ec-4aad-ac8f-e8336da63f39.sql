CREATE OR REPLACE FUNCTION public.create_subsample(
  _parent_sample_id uuid,
  _measurement_id uuid DEFAULT NULL,
  _name text DEFAULT NULL,
  _description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p        public.samples%ROWTYPE;
  suffix   text;
  used     integer;
  new_id   uuid;
BEGIN
  SELECT * INTO p FROM public.samples WHERE id = _parent_sample_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ausgangsprobe nicht gefunden';
  END IF;

  SELECT COUNT(*) INTO used FROM public.samples WHERE parent_sample_id = _parent_sample_id;
  suffix := chr(65 + (used % 26));

  INSERT INTO public.samples (
    sample_name, project_id, description, parent_sample_id, subsample_suffix,
    prepared_for_measurement_id, order_id, location_id, status,
    hazard_categories, is_hazardous, category, raw_material_id, raw_material_code,
    lot_number, created_by
  ) VALUES (
    COALESCE(_name, p.sample_name || ' – ' || suffix),
    p.project_id,
    _description,
    p.id,
    suffix,
    _measurement_id,
    p.order_id,
    p.location_id,
    'neu',
    p.hazard_categories,
    p.is_hazardous,
    p.category,
    p.raw_material_id,
    p.raw_material_code,
    p.lot_number,
    auth.uid()
  )
  RETURNING id INTO new_id;

  IF _measurement_id IS NOT NULL THEN
    UPDATE public.order_measurements
      SET sample_id = new_id,
          original_sample_id = COALESCE(original_sample_id, _parent_sample_id)
    WHERE id = _measurement_id;
  END IF;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_subsample(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_subsample(uuid, uuid, text, text) TO authenticated, service_role;

-- Arbeitsuebersicht fuer den Probenvorbereiter
CREATE OR REPLACE FUNCTION public.get_order_preparation_overview(_order_id uuid)
RETURNS TABLE (
  measurement_id uuid,
  measurement_number text,
  service_id uuid,
  service_name text,
  origin text,
  status text,
  is_ready boolean,
  sample_id uuid,
  sample_number text,
  sample_name text,
  parent_sample_id uuid,
  parent_sample_number text,
  subsample_suffix text,
  requires_subsample boolean,
  preparation_note text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.measurement_number,
    m.service_id,
    s.service_name,
    m.origin,
    m.status::text,
    public.measurement_is_ready(m.id),
    m.sample_id,
    sa.sample_number,
    sa.sample_name,
    sa.parent_sample_id,
    par.sample_number,
    sa.subsample_suffix,
    COALESCE(ps.creates_subsample, false),
    ps.description
  FROM public.order_measurements m
  LEFT JOIN public.measurement_services s ON s.id = m.service_id
  LEFT JOIN public.samples sa ON sa.id = m.sample_id
  LEFT JOIN public.samples par ON par.id = sa.parent_sample_id
  LEFT JOIN public.process_steps ps
         ON ps.step_key = m.source_step_key
        AND ps.service_id = m.service_id
  WHERE m.order_id = _order_id
  ORDER BY sa.sample_number NULLS LAST, m.measurement_number;
$$;

REVOKE ALL ON FUNCTION public.get_order_preparation_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_order_preparation_overview(uuid) TO authenticated, service_role;