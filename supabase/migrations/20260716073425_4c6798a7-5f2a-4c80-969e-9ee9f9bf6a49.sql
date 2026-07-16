
-- 1) Company setting: enforcement mode
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS raw_material_check_mode text NOT NULL DEFAULT 'warn'
    CHECK (raw_material_check_mode IN ('warn','allow','block'));

-- 2) Link table: process step <-> raw material with target quantities
CREATE TABLE IF NOT EXISTS public.process_step_raw_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  step_id UUID NOT NULL REFERENCES public.process_steps(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE RESTRICT,
  target_quantity NUMERIC NOT NULL CHECK (target_quantity >= 0),
  unit TEXT,
  tolerance_percent NUMERIC,
  note TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (step_id, raw_material_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.process_step_raw_materials TO authenticated;
GRANT ALL ON public.process_step_raw_materials TO service_role;

ALTER TABLE public.process_step_raw_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psrm read" ON public.process_step_raw_materials
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "psrm master manage" ON public.process_step_raw_materials
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'master'::app_role));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_psrm_updated_at ON public.process_step_raw_materials;
CREATE TRIGGER trg_psrm_updated_at BEFORE UPDATE ON public.process_step_raw_materials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Availability check function
CREATE OR REPLACE FUNCTION public.process_step_raw_material_availability(
  _step_id UUID,
  _scale NUMERIC DEFAULT 1
)
RETURNS TABLE (
  psrm_id UUID,
  raw_material_id UUID,
  material_name TEXT,
  material_number TEXT,
  required NUMERIC,
  available NUMERIC,
  missing NUMERIC,
  unit TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    psrm.id AS psrm_id,
    rm.id AS raw_material_id,
    rm.material_name,
    rm.material_number,
    (psrm.target_quantity * COALESCE(_scale, 1))::numeric AS required,
    COALESCE((
      SELECT SUM(GREATEST(c.current_quantity - COALESCE(c.reserved_quantity, 0), 0))
      FROM public.raw_material_containers c
      WHERE c.raw_material_id = rm.id
        AND (c.status IS NULL OR c.status::text NOT IN ('leer','gesperrt','entsorgt'))
        AND c.current_quantity > 0
    ), 0)::numeric AS available,
    GREATEST(
      (psrm.target_quantity * COALESCE(_scale, 1))
      - COALESCE((
          SELECT SUM(GREATEST(c.current_quantity - COALESCE(c.reserved_quantity, 0), 0))
          FROM public.raw_material_containers c
          WHERE c.raw_material_id = rm.id
            AND (c.status IS NULL OR c.status::text NOT IN ('leer','gesperrt','entsorgt'))
            AND c.current_quantity > 0
        ), 0)
    , 0)::numeric AS missing,
    COALESCE(psrm.unit, rm.unit) AS unit
  FROM public.process_step_raw_materials psrm
  JOIN public.raw_materials rm ON rm.id = psrm.raw_material_id
  WHERE psrm.step_id = _step_id
  ORDER BY psrm.sort_order, rm.material_name;
$$;

GRANT EXECUTE ON FUNCTION public.process_step_raw_material_availability(UUID, NUMERIC) TO authenticated;
