
-- Add sample_id column to measurement_orders
ALTER TABLE public.measurement_orders
ADD COLUMN sample_id uuid REFERENCES public.samples(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_measurement_orders_sample_id ON public.measurement_orders(sample_id);
