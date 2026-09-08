-- Abschluss einer Fertigungsfreigabe-Revision: Prüfung erledigt + Status "abgeschlossen" + Revision wird aktueller Stand – atomar.
CREATE OR REPLACE FUNCTION public.complete_production_release_revision(_release_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _rev public.production_releases%ROWTYPE;
  _pending int;
  _open_specs int;
  _now timestamptz := now();
  _promo jsonb := NULL;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet.' USING ERRCODE = '28000', HINT = 'RELEASE_UNAUTHENTICATED';
  END IF;
  IF NOT (public.has_role(_uid, 'master') OR public.has_permission(_uid, 'production_releases.approve')) THEN
    RAISE EXCEPTION 'Keine Berechtigung, Fertigungsfreigaben abzuschließen.' USING ERRCODE = '42501', HINT = 'RELEASE_FORBIDDEN';
  END IF;

  SELECT * INTO _rev FROM public.production_releases WHERE id = _release_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Revision % nicht gefunden.', _release_id USING ERRCODE = 'P0002', HINT = 'RELEASE_NOT_FOUND';
  END IF;
  IF _rev.superseded_at IS NOT NULL THEN
    RAISE EXCEPTION 'Revision % ist historisch und kann nicht abgeschlossen werden.', COALESCE(_rev.revision_number, 0) USING ERRCODE = '22023', HINT = 'RELEASE_SUPERSEDED';
  END IF;
  IF _rev.status = 'abgeschlossen' THEN
    RAISE EXCEPTION 'Revision % ist bereits abgeschlossen.', COALESCE(_rev.revision_number, 0) USING ERRCODE = '22023', HINT = 'RELEASE_ALREADY_COMPLETED';
  END IF;

  SELECT count(*) INTO _pending FROM public.production_release_changes WHERE release_id = _release_id AND status = 'pending';
  IF _pending > 0 THEN
    RAISE EXCEPTION '% offene Prüfpunkt(e) müssen vor dem Abschluss erledigt werden.', _pending USING ERRCODE = '23514', HINT = 'RELEASE_PENDING_CHANGES';
  END IF;
  SELECT count(*) INTO _open_specs
  FROM public.production_release_spec_values v
  JOIN public.production_release_spec_sets s ON s.id = v.spec_set_id
  WHERE s.release_id = _release_id AND v.needs_review IS TRUE AND v.confirmed_at IS NULL;
  IF _open_specs > 0 THEN
    RAISE EXCEPTION '% unsicher erkannte Vorgabe(n) müssen vor dem Abschluss bestätigt werden.', _open_specs USING ERRCODE = '23514', HINT = 'RELEASE_PENDING_SPECS';
  END IF;

  -- Noch nicht aktueller Stand → über bestehende Freigabe-Logik zum aktuellen Stand machen (gleiche Transaktion).
  IF _rev.is_current IS NOT TRUE THEN
    _promo := public.release_production_release_revision(_release_id);
  END IF;

  UPDATE public.production_releases
     SET status = 'abgeschlossen',
         import_status = 'reviewed',
         reviewed_at = COALESCE(reviewed_at, _now),
         reviewed_by = COALESCE(reviewed_by, _uid),
         released_at = COALESCE(released_at, _now),
         released_by = COALESCE(released_by, _uid),
         updated_by = _uid
   WHERE id = _release_id;

  RETURN jsonb_build_object(
    'release_id', _release_id,
    'revision_number', _rev.revision_number,
    'status', 'abgeschlossen',
    'promoted', _promo IS NOT NULL,
    'promotion', _promo,
    'completed_at', _now,
    'completed_by', _uid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_production_release_revision(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_production_release_revision(uuid) TO authenticated;