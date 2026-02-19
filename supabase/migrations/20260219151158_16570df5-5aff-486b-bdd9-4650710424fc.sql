
-- Only create triggers that don't exist yet
CREATE TRIGGER trg_generate_sample_number
  BEFORE INSERT ON public.samples
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_sample_number();

CREATE TRIGGER trg_generate_measurement_number
  BEFORE INSERT ON public.order_measurements
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_measurement_number();
