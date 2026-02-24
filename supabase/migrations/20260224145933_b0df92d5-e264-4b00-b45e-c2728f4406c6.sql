
-- Table for measurement results (Ergebnisse)
CREATE TABLE public.measurement_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_measurement_id uuid NOT NULL REFERENCES public.order_measurements(id) ON DELETE CASCADE,
  result_name text NOT NULL,
  unit text,
  value numeric,
  temperature_range_from numeric,
  temperature_range_to numeric,
  temperature_unit text DEFAULT '°C',
  remarks text,
  measured_at date DEFAULT CURRENT_DATE,
  measured_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.measurement_results ENABLE ROW LEVEL SECURITY;

-- Select: same as measurement_parameters
CREATE POLICY "Users see relevant results"
ON public.measurement_results
FOR SELECT
USING (
  is_assigned_to_measurement(auth.uid(), order_measurement_id)
  OR has_role(auth.uid(), 'master'::app_role)
  OR is_order_creator_via_measurement(auth.uid(), order_measurement_id)
);

-- Insert/Update/Delete: only durchfuehrer (assigned) and master
CREATE POLICY "Durchfuehrer and masters manage results"
ON public.measurement_results
FOR ALL
USING (
  has_role(auth.uid(), 'master'::app_role)
  OR (has_role(auth.uid(), 'durchfuehrer'::app_role) AND is_assigned_to_measurement(auth.uid(), order_measurement_id))
)
WITH CHECK (
  has_role(auth.uid(), 'master'::app_role)
  OR (has_role(auth.uid(), 'durchfuehrer'::app_role) AND is_assigned_to_measurement(auth.uid(), order_measurement_id))
);

-- Timestamp trigger
CREATE TRIGGER update_measurement_results_updated_at
BEFORE UPDATE ON public.measurement_results
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
