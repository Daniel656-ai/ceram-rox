CREATE OR REPLACE FUNCTION public.release_production_release_revision(_release_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _rev public.production_releases%ROWTYPE;
  _root uuid;
  _prev_id uuid;
  _pending int;
  _open_specs int;
  _now timestamptz := now();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet.' USING ERRCODE = '28000', HINT = 'RELEASE_UNAUTHENTICATED';
  END IF;
  IF NOT (public.has_role(_uid, 'master') OR public.has_permission(_uid, 'production_releases.approve') OR public.has_permission(_uid, 'production_releases.edit')) THEN
    RAISE EXCEPTION 'Keine Berechtigung, Revisionen freizugeben.' USING ERRCODE = '42501', HINT = 'RELEASE_FORBIDDEN';
  END IF;

  SELECT * INTO _rev FROM public.production_releases WHERE id = _release_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Revision % nicht gefunden.', _release_id USING ERRCODE = 'P0002', HINT = 'RELEASE_NOT_FOUND';
  END IF;

  _root := COALESCE(_rev.root_release_id, _rev.id);

  IF _rev.is_current IS TRUE THEN
    RAISE EXCEPTION 'Revision % ist bereits der aktuelle Stand.', COALESCE(_rev.revision_number, 0) USING ERRCODE = '22023', HINT = 'RELEASE_ALREADY_CURRENT';
  END IF;
  IF _rev.superseded_at IS NOT NULL THEN
    RAISE EXCEPTION 'Revision % ist eine historische Revision und kann nicht erneut freigegeben werden.', COALESCE(_rev.revision_number, 0) USING ERRCODE = '22023', HINT = 'RELEASE_SUPERSEDED';
  END IF;

  SELECT count(*) INTO _pending FROM public.production_release_changes WHERE release_id = _release_id AND status = 'pending';
  IF _pending > 0 THEN
    RAISE EXCEPTION '% offene Prüfpunkt(e) müssen vor der Freigabe erledigt werden.', _pending USING ERRCODE = '23514', HINT = 'RELEASE_PENDING_CHANGES';
  END IF;

  SELECT count(*) INTO _open_specs
  FROM public.production_release_spec_values v
  JOIN public.production_release_spec_sets s ON s.id = v.spec_set_id
  WHERE s.release_id = _release_id AND v.needs_review IS TRUE AND v.confirmed_at IS NULL;
  IF _open_specs > 0 THEN
    RAISE EXCEPTION '% unsicher erkannte Vorgabe(n) müssen vor der Freigabe bestätigt werden.', _open_specs USING ERRCODE = '23514', HINT = 'RELEASE_PENDING_SPECS';
  END IF;

  -- Bisherigen aktuellen Stand sperren und ablösen (bleibt als Historie erhalten)
  SELECT id INTO _prev_id FROM public.production_releases
   WHERE COALESCE(root_release_id, id) = _root AND is_current IS TRUE AND id <> _release_id
   FOR UPDATE;

  UPDATE public.production_releases
     SET is_current = false, superseded_at = _now, updated_by = _uid
   WHERE COALESCE(root_release_id, id) = _root AND is_current IS TRUE AND id <> _release_id;

  UPDATE public.production_releases
     SET is_current = true,
         superseded_at = NULL,
         import_status = 'reviewed',
         reviewed_at = _now,
         reviewed_by = _uid,
         updated_by = _uid,
         root_release_id = _root
   WHERE id = _release_id;

  RETURN jsonb_build_object(
    'release_id', _release_id,
    'root_release_id', _root,
    'previous_release_id', _prev_id,
    'revision_number', _rev.revision_number,
    'released_at', _now,
    'released_by', _uid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.release_production_release_revision(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.release_production_release_revision(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_production_release_revision(uuid) TO service_role;