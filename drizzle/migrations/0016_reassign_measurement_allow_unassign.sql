CREATE OR REPLACE FUNCTION public.reassign_measurement(_measurement_id uuid, _new_user_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.order_measurements%ROWTYPE;
  _project uuid;
  _mode text;
  _unassign boolean := _new_user_id IS NULL;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _reason IS NULL OR btrim(_reason) = '' THEN RAISE EXCEPTION 'reason required'; END IF;

  SELECT * INTO _row FROM public.order_measurements WHERE id = _measurement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'measurement not found'; END IF;
  IF _row.status = 'completed' THEN RAISE EXCEPTION 'measurement already completed'; END IF;
  IF _unassign AND _row.assigned_to IS NULL THEN RAISE EXCEPTION 'not assigned'; END IF;
  IF NOT _unassign AND _row.assigned_to IS NOT DISTINCT FROM _new_user_id THEN RAISE EXCEPTION 'already assigned to this user'; END IF;

  SELECT project_id INTO _project FROM public.measurement_orders WHERE id = _row.order_id;

  IF public.has_role(_uid, 'master'::app_role) THEN
    _mode := 'master';
  ELSIF _project IS NOT NULL AND (public.has_project_role(_uid, _project, 'owner'::project_role)
                                  OR public.has_project_role(_uid, _project, 'leader'::project_role)) THEN
    _mode := 'project_lead';
  ELSIF _row.assigned_to = _uid THEN
    _mode := 'handover';
  ELSE
    RAISE EXCEPTION 'not permitted';
  END IF;

  IF NOT _unassign THEN
    IF public.is_external_customer(_new_user_id) THEN RAISE EXCEPTION 'target not qualified'; END IF;
    IF NOT public.has_role(_new_user_id, 'master'::app_role) AND NOT EXISTS (
      SELECT 1 FROM public.mdl_service_permissions WHERE user_id = _new_user_id AND service_id = _row.service_id
    ) THEN
      RAISE EXCEPTION 'target not qualified';
    END IF;
  END IF;

  UPDATE public.order_measurements SET assigned_to = _new_user_id WHERE id = _measurement_id;

  INSERT INTO public.activity_log (event_type, actor_user_id, order_id, order_measurement_id, project_id, service_id, metadata)
  VALUES ('measurement_reassigned', _uid, _row.order_id, _row.id, _project, _row.service_id,
          jsonb_build_object('from_user_id', _row.assigned_to, 'to_user_id', _new_user_id,
                             'action', CASE WHEN _unassign THEN 'unassigned' ELSE 'reassigned' END,
                             'reason', btrim(_reason), 'mode', _mode,
                             'measurement_number', _row.measurement_number, 'status', _row.status));
  RETURN _measurement_id;
END $$;
REVOKE ALL ON FUNCTION public.reassign_measurement(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reassign_measurement(uuid, uuid, text) TO authenticated;