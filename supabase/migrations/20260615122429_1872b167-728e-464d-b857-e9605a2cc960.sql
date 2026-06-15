
-- Link sample to the mixture batch it was produced from (optional)
ALTER TABLE public.samples
  ADD COLUMN IF NOT EXISTS mixture_batch_id uuid REFERENCES public.mixture_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS samples_mixture_batch_idx ON public.samples(mixture_batch_id);


-- Full sample traceability: returns one JSON record with batch + mixture + recipe + consumed material batches
CREATE OR REPLACE FUNCTION public.get_sample_traceability(_sample_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'sample_id', s.id,
    'sample_number', s.sample_number,
    'sample_name', s.sample_name,
    'created_at', s.created_at,
    'mixture_batch', CASE WHEN mb.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', mb.id,
      'batch_number', mb.batch_number,
      'produced_at', mb.produced_at,
      'produced_quantity', mb.produced_quantity,
      'unit', mb.unit,
      'concentration', mb.concentration,
      'notes', mb.notes,
      'produced_by', mb.produced_by,
      'producer_first_name', pf.first_name,
      'producer_last_name', pf.last_name
    ) END,
    'mixture', CASE WHEN m.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', m.id,
      'name', m.name,
      'mixture_number', m.mixture_number,
      'category', m.category,
      'target_concentration', m.target_concentration
    ) END,
    'recipe', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'raw_material_id', ri.raw_material_id,
        'material_name', rm.material_name,
        'material_number', rm.material_number,
        'quantity', ri.quantity,
        'unit', ri.unit
      ) ORDER BY ri.position)
      FROM mixture_recipe_items ri
      JOIN raw_materials rm ON rm.id = ri.raw_material_id
      WHERE ri.mixture_id = m.id
    ), '[]'::jsonb),
    'consumed_raw_materials', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'raw_material_id', c.raw_material_id,
        'material_name', rm.material_name,
        'material_number', rm.material_number,
        'raw_material_batch_id', c.raw_material_batch_id,
        'batch_number', rb.batch_number,
        'delivery_date', rb.delivery_date,
        'quantity', c.quantity,
        'unit', c.unit
      ))
      FROM mixture_batch_consumptions c
      JOIN raw_materials rm ON rm.id = c.raw_material_id
      LEFT JOIN raw_material_batches rb ON rb.id = c.raw_material_batch_id
      WHERE c.mixture_batch_id = mb.id
    ), '[]'::jsonb)
  )
  FROM samples s
  LEFT JOIN mixture_batches mb ON mb.id = s.mixture_batch_id
  LEFT JOIN mixtures m ON m.id = mb.mixture_id
  LEFT JOIN profiles pf ON pf.user_id = mb.produced_by
  WHERE s.id = _sample_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_sample_traceability(uuid) TO authenticated;


-- Forward traceability: which samples were derived from a given raw material
-- (via any consumption record, optionally narrowed to a single raw material batch)
CREATE OR REPLACE FUNCTION public.get_raw_material_derived_samples(
  _raw_material_id uuid,
  _raw_material_batch_id uuid DEFAULT NULL
)
RETURNS TABLE (
  sample_id uuid,
  sample_number text,
  sample_name text,
  sample_created_at timestamptz,
  mixture_batch_id uuid,
  mixture_batch_number text,
  mixture_id uuid,
  mixture_name text,
  consumed_quantity numeric,
  consumed_unit text,
  raw_material_batch_id uuid,
  raw_material_batch_number text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id            AS sample_id,
    s.sample_number,
    s.sample_name,
    s.created_at    AS sample_created_at,
    mb.id           AS mixture_batch_id,
    mb.batch_number AS mixture_batch_number,
    m.id            AS mixture_id,
    m.name          AS mixture_name,
    c.quantity      AS consumed_quantity,
    c.unit          AS consumed_unit,
    c.raw_material_batch_id,
    rb.batch_number AS raw_material_batch_number
  FROM mixture_batch_consumptions c
  JOIN mixture_batches mb ON mb.id = c.mixture_batch_id
  JOIN mixtures m         ON m.id = mb.mixture_id
  JOIN samples s          ON s.mixture_batch_id = mb.id
  LEFT JOIN raw_material_batches rb ON rb.id = c.raw_material_batch_id
  WHERE c.raw_material_id = _raw_material_id
    AND (_raw_material_batch_id IS NULL OR c.raw_material_batch_id = _raw_material_batch_id)
  ORDER BY s.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_raw_material_derived_samples(uuid, uuid) TO authenticated;
