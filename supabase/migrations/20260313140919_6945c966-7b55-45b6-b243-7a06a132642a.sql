
-- Consumables catalog table
CREATE TABLE public.consumables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price_per_unit numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'Stück',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.consumables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read consumables"
  ON public.consumables FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Masters and auftraggeber manage consumables"
  ON public.consumables FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master') OR has_role(auth.uid(), 'auftraggeber'))
  WITH CHECK (has_role(auth.uid(), 'master') OR has_role(auth.uid(), 'auftraggeber'));

-- Project consumable bookings
CREATE TABLE public.project_consumables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  consumable_id uuid NOT NULL REFERENCES public.consumables(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL,
  unit_price numeric NOT NULL,
  total_cost numeric GENERATED ALWAYS AS (quantity * unit_price) STORED,
  comment text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_consumables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read project_consumables"
  ON public.project_consumables FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Masters and auftraggeber manage project_consumables"
  ON public.project_consumables FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master') OR has_role(auth.uid(), 'auftraggeber'))
  WITH CHECK (has_role(auth.uid(), 'master') OR has_role(auth.uid(), 'auftraggeber'));

-- Add price_per_kg to raw_materials
ALTER TABLE public.raw_materials ADD COLUMN IF NOT EXISTS price_per_kg numeric DEFAULT 0;

-- Project knetung material bookings (raw materials used in "Knetung" measurements)
CREATE TABLE public.project_knetung_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE RESTRICT,
  order_measurement_id uuid REFERENCES public.order_measurements(id) ON DELETE SET NULL,
  quantity_kg numeric NOT NULL,
  price_per_kg numeric NOT NULL,
  total_cost numeric GENERATED ALWAYS AS (quantity_kg * price_per_kg) STORED,
  comment text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_knetung_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read project_knetung_materials"
  ON public.project_knetung_materials FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Masters and auftraggeber manage project_knetung_materials"
  ON public.project_knetung_materials FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master') OR has_role(auth.uid(), 'auftraggeber'))
  WITH CHECK (has_role(auth.uid(), 'master') OR has_role(auth.uid(), 'auftraggeber'));
