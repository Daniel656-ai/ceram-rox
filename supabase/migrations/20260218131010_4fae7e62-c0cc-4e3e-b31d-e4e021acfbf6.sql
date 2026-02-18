
-- 1. Neuer Enum-Typ für Auftragspriorität
CREATE TYPE public.order_priority AS ENUM ('normal', 'wichtig', 'hoechste');

-- 2. Neue Spalte auf measurement_orders
ALTER TABLE public.measurement_orders
  ADD COLUMN priority order_priority NOT NULL DEFAULT 'normal';

-- 3. Audit-Log-Tabelle
CREATE TABLE public.order_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.measurement_orders(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  field_name text NOT NULL,
  old_value text,
  new_value text
);

ALTER TABLE public.order_audit_log ENABLE ROW LEVEL SECURITY;

-- SELECT: Master sehen alles; Ersteller eigene; Durchfuehrer zugewiesene
CREATE POLICY "Users see relevant audit logs"
  ON public.order_audit_log FOR SELECT
  USING (
    has_role(auth.uid(), 'master'::app_role)
    OR is_order_creator(auth.uid(), order_id)
    OR is_assigned_to_order(auth.uid(), order_id)
  );

-- INSERT: Nur durch Trigger, aber Policy erlaubt für auth user
CREATE POLICY "System inserts audit logs"
  ON public.order_audit_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Trigger-Funktion für Audit-Log bei Prioritätsänderung
CREATE OR REPLACE FUNCTION public.log_order_priority_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO public.order_audit_log (order_id, changed_by, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'priority', OLD.priority::text, NEW.priority::text);
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Trigger
CREATE TRIGGER trg_log_order_priority_change
  BEFORE UPDATE ON public.measurement_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_order_priority_change();
