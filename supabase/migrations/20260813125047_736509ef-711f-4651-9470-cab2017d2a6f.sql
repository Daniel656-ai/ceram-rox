CREATE OR REPLACE FUNCTION public.enforce_order_lock_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public._order_lock_bypass() THEN RETURN COALESCE(NEW, OLD); END IF;
  IF OLD.workflow_status = 'abgeschlossen' THEN
    RAISE EXCEPTION 'Auftrag ist abgeschlossen und schreibgeschützt.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;