
-- 1. Add standard_duration_hours to measurement_services
ALTER TABLE public.measurement_services
ADD COLUMN standard_duration_hours numeric NOT NULL DEFAULT 1;

-- 2. Add actual duration, deviation reason, and scheduling fields to order_measurements
ALTER TABLE public.order_measurements
ADD COLUMN actual_duration_hours numeric NULL,
ADD COLUMN duration_deviation_reason text NULL,
ADD COLUMN planned_start_date date NULL,
ADD COLUMN planned_end_date date NULL,
ADD COLUMN estimated_delivery_date date NULL,
ADD COLUMN processing_time_hours numeric NOT NULL DEFAULT 0;

-- 3. Audit trigger for standard_duration_hours changes on measurement_services
CREATE OR REPLACE FUNCTION public.log_service_duration_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.standard_duration_hours IS DISTINCT FROM NEW.standard_duration_hours THEN
    INSERT INTO public.mdl_permission_audit_log (user_id, service_id, action, changed_by)
    VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      NEW.id,
      'standard_duration_changed: ' || OLD.standard_duration_hours || 'h -> ' || NEW.standard_duration_hours || 'h',
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_service_duration_change
BEFORE UPDATE ON public.measurement_services
FOR EACH ROW
EXECUTE FUNCTION public.log_service_duration_change();
