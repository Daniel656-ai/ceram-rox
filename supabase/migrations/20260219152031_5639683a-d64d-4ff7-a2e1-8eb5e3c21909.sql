
-- Remove duplicate triggers (keep the original ones)
DROP TRIGGER IF EXISTS trg_generate_sample_number ON public.samples;
DROP TRIGGER IF EXISTS trg_generate_measurement_number ON public.order_measurements;
