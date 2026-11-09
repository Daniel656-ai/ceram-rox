ALTER TABLE public.measurement_orders
  ADD COLUMN is_billed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.measurement_orders.is_billed
  IS 'Verrechnungsstatus (nur Anzeige, keine Abrechnungslogik)';

CREATE OR REPLACE FUNCTION public.set_order_billed(p_order_id uuid, p_value boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.measurement_orders%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Nicht angemeldet' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_order_id IS NULL OR p_value IS NULL THEN RAISE EXCEPTION 'Ungueltige Parameter'; END IF;

  SELECT * INTO v_order FROM public.measurement_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auftrag nicht gefunden'; END IF;

  IF NOT (public.has_role(v_uid, 'master'::app_role) OR v_order.created_by = v_uid) THEN
    RAISE EXCEPTION 'Keine Berechtigung zur Aenderung des Verrechnungsstatus' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_order.order_type IS DISTINCT FROM 'customer'::order_type THEN
    RAISE EXCEPTION 'Verrechnungsstatus gilt nur fuer Kundenauftraege';
  END IF;
  IF v_order.is_billed = p_value THEN
    RETURN v_order.is_billed;
  END IF;

  PERFORM set_config('app.bypass_order_lock', 'on', true);
  UPDATE public.measurement_orders SET is_billed = p_value WHERE id = p_order_id;
  PERFORM set_config('app.bypass_order_lock', 'off', true);

  INSERT INTO public.activity_log (event_type, actor_user_id, order_id, project_id, metadata)
  VALUES ('order_billing_updated', v_uid, p_order_id, v_order.project_id,
          jsonb_build_object('old_value', v_order.is_billed, 'new_value', p_value));

  RETURN p_value;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_order_billed(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_order_billed(uuid, boolean) TO authenticated;