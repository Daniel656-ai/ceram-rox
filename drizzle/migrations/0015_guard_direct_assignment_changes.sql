-- Direkte Änderungen von order_measurements.assigned_to aus der App (Rollen
-- authenticated/anon) sind nicht mehr zulässig. Zuweisungen laufen nur über
-- die SECURITY-DEFINER-Funktionen (claim/release/reassign und bestehende
-- Systemtrigger), die als Funktionseigentümer ausgeführt werden.
-- Alle anderen Felder bleiben über die bestehende UPDATE-Policy änderbar.
CREATE OR REPLACE FUNCTION public.guard_measurement_assignment_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'direct assignment change not allowed – use claim/release/reassign'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_guard_measurement_assignment
BEFORE UPDATE OF assigned_to ON public.order_measurements
FOR EACH ROW EXECUTE FUNCTION public.guard_measurement_assignment_change();