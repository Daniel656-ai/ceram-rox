
ALTER TABLE public.mixture_batches
  ADD COLUMN IF NOT EXISTS expiry_date date;

ALTER TABLE public.samples
  ADD COLUMN IF NOT EXISTS sampled_at timestamptz,
  ADD COLUMN IF NOT EXISTS sampled_by uuid;

-- Helper view: unified batches (raw + mixture)
CREATE OR REPLACE VIEW public.unified_batches AS
SELECT
  rb.id::text                              AS id,
  'raw'::text                              AS batch_kind,
  rb.batch_number,
  rm.material_name                         AS product_name,
  NULL::uuid                               AS recipe_id,
  NULL::text                               AS recipe_name,
  rb.delivery_date::timestamptz            AS produced_at,
  NULL::uuid                               AS produced_by,
  rb.delivery_quantity                     AS quantity,
  rm.unit                                  AS unit,
  NULL::date                               AS expiry_date,
  'aktiv'::text                            AS status,
  rb.raw_material_id                       AS source_id,
  rb.notes                                 AS notes,
  rb.created_at
FROM public.raw_material_batches rb
JOIN public.raw_materials rm ON rm.id = rb.raw_material_id
UNION ALL
SELECT
  mb.id::text                              AS id,
  'mixture'::text                          AS batch_kind,
  mb.batch_number,
  m.name                                   AS product_name,
  m.id                                     AS recipe_id,
  m.name                                   AS recipe_name,
  mb.produced_at,
  mb.produced_by,
  mb.produced_quantity                     AS quantity,
  mb.unit,
  mb.expiry_date,
  CASE
    WHEN mb.status = 'discarded' THEN 'gesperrt'
    ELSE 'aktiv'
  END                                      AS status,
  mb.mixture_id                            AS source_id,
  mb.notes,
  mb.created_at
FROM public.mixture_batches mb
JOIN public.mixtures m ON m.id = mb.mixture_id;

GRANT SELECT ON public.unified_batches TO authenticated;
GRANT ALL ON public.unified_batches TO service_role;
