CREATE OR REPLACE FUNCTION public.get_container_positions(_container_id uuid)
RETURNS TABLE(
  position_id uuid,
  batch_id uuid,
  batch_number text,
  manufacturer_batch text,
  delivery_date date,
  quantity numeric,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT p.id, p.batch_id, b.batch_number, b.manufacturer_batch, b.delivery_date, p.quantity, p.created_at
    FROM public.container_batch_positions p
    JOIN public.raw_material_batches b ON b.id = p.batch_id
   WHERE p.container_id = _container_id
     AND p.quantity > 0
   ORDER BY b.delivery_date NULLS LAST, p.created_at ASC;
$$;