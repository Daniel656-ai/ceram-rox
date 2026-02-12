
-- Add workstation_id to order_measurements
ALTER TABLE public.order_measurements
ADD COLUMN workstation_id uuid REFERENCES public.workstations(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX idx_order_measurements_workstation ON public.order_measurements(workstation_id);
