-- ROX zentrale Änderungshistorie public.historian (v3, freigegeben)
DO $$
BEGIN
  IF to_regclass('public.historian') IS NOT NULL THEN
    RAISE EXCEPTION 'public.historian existiert bereits – Migration abgebrochen, bitte manuell prüfen.';
  END IF;
  IF to_regprocedure('public.has_role(uuid, app_role)') IS NULL
     OR to_regprocedure('public.has_project_role(uuid, uuid, project_role)') IS NULL
     OR to_regprocedure('public.can_read_order_via_measurement(uuid, uuid)') IS NULL
     OR to_regprocedure('public.is_assigned_to_order(uuid, uuid)') IS NULL
     OR to_regprocedure('public.is_external_customer(uuid)') IS NULL
     OR to_regprocedure('public.external_owns_sample(uuid, uuid)') IS NULL THEN
    RAISE EXCEPTION 'Benötigte Hilfsfunktionen fehlen – Migration abgebrochen.';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND data_type = 'uuid'
        AND (table_name, column_name) IN (
          ('projects','id'),
          ('measurement_orders','id'), ('measurement_orders','project_id'), ('measurement_orders','sample_id'),
          ('samples','id'), ('samples','project_id'), ('samples','order_id'),
          ('order_measurements','id'), ('order_measurements','order_id'), ('order_measurements','sample_id')
        )) <> 10 THEN
    RAISE EXCEPTION 'Erwartete uuid-Spalten fehlen oder haben einen anderen Typ – Migration abgebrochen.';
  END IF;
END $$;

CREATE TABLE public.historian (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  occurred_at           timestamptz NOT NULL DEFAULT now(),
  entity_type           text        NOT NULL,
  entity_id             uuid        NOT NULL,
  action                text        NOT NULL CHECK (action IN ('insert','update','delete')),
  changed_fields        text[]      NOT NULL DEFAULT '{}',
  project_id            uuid,
  order_id              uuid,
  sample_id             uuid,
  order_measurement_id  uuid,
  changed_by            uuid,
  actor_source          text        NOT NULL,
  db_role               text        NOT NULL DEFAULT session_user,
  txid                  bigint      NOT NULL DEFAULT txid_current(),
  summary               text,
  CONSTRAINT historian_event_id_key UNIQUE (event_id)
);

COMMENT ON TABLE public.historian IS
  'Zentrale Änderungshistorie (nur Feldnamen, 365 Tage). Schreiben ausschließlich über Trigger.';

REVOKE ALL ON public.historian FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.historian TO authenticated;
GRANT ALL    ON public.historian TO service_role;

CREATE INDEX historian_occurred_at_idx ON public.historian (occurred_at);
CREATE INDEX historian_entity_idx      ON public.historian (entity_type, entity_id, occurred_at DESC);
CREATE INDEX historian_project_idx     ON public.historian (project_id, occurred_at DESC) WHERE project_id IS NOT NULL;
CREATE INDEX historian_order_idx       ON public.historian (order_id, occurred_at DESC)   WHERE order_id IS NOT NULL;
CREATE INDEX historian_sample_idx      ON public.historian (sample_id, occurred_at DESC)  WHERE sample_id IS NOT NULL;
CREATE INDEX historian_om_idx          ON public.historian (order_measurement_id, occurred_at DESC) WHERE order_measurement_id IS NOT NULL;
CREATE INDEX historian_changed_by_idx  ON public.historian (changed_by, occurred_at DESC) WHERE changed_by IS NOT NULL;

ALTER TABLE public.historian ENABLE ROW LEVEL SECURITY;

CREATE POLICY historian_select_master ON public.historian
  FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'master'));

CREATE POLICY historian_select_project_lead ON public.historian
  FOR SELECT TO authenticated
  USING (
    project_id IS NOT NULL AND (
      public.has_project_role((SELECT auth.uid()), project_id, 'owner')
      OR public.has_project_role((SELECT auth.uid()), project_id, 'leader')
    )
  );

CREATE POLICY historian_select_order_access ON public.historian
  FOR SELECT TO authenticated
  USING (
    order_id IS NOT NULL AND (
      public.is_assigned_to_order((SELECT auth.uid()), order_id)
      OR public.can_read_order_via_measurement((SELECT auth.uid()), order_id)
    )
  );

CREATE POLICY historian_restrict_external ON public.historian
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    NOT public.is_external_customer((SELECT auth.uid()))
    OR (sample_id IS NOT NULL AND public.external_owns_sample((SELECT auth.uid()), sample_id))
  );

CREATE FUNCTION public.historian_log_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new        jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  _old        jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  _row        jsonb;
  _fields     text[] := '{}';
  _uid        uuid;
  _entity     text := TG_ARGV[0];
  _project_id uuid;
  _order_id   uuid;
  _sample_id  uuid;
  _om_id      uuid;
BEGIN
  BEGIN
    _row := COALESCE(_new, _old);

    BEGIN
      _uid := auth.uid();
    EXCEPTION WHEN OTHERS THEN
      _uid := NULL;
    END;

    IF TG_OP = 'UPDATE' THEN
      SELECT COALESCE(array_agg(k ORDER BY k), '{}') INTO _fields
      FROM jsonb_object_keys(_new) AS k
      WHERE k NOT IN ('updated_at')
        AND (_new -> k) IS DISTINCT FROM (_old -> k);
      IF cardinality(_fields) = 0 THEN
        RETURN NULL;
      END IF;
    END IF;

    _project_id := CASE _entity WHEN 'project' THEN (_row ->> 'id')::uuid
                     ELSE NULLIF(_row ->> 'project_id', '')::uuid END;
    _order_id   := CASE _entity WHEN 'order' THEN (_row ->> 'id')::uuid
                     ELSE NULLIF(_row ->> 'order_id', '')::uuid END;
    _sample_id  := CASE _entity WHEN 'sample' THEN (_row ->> 'id')::uuid
                     ELSE NULLIF(_row ->> 'sample_id', '')::uuid END;
    _om_id      := CASE _entity WHEN 'order_measurement' THEN (_row ->> 'id')::uuid
                     ELSE NULLIF(_row ->> 'order_measurement_id', '')::uuid END;

    IF _order_id IS NULL AND _om_id IS NOT NULL THEN
      SELECT om.order_id, COALESCE(_sample_id, om.sample_id) INTO _order_id, _sample_id
      FROM public.order_measurements om WHERE om.id = _om_id;
    END IF;

    IF _project_id IS NULL AND _order_id IS NOT NULL THEN
      SELECT mo.project_id INTO _project_id
      FROM public.measurement_orders mo WHERE mo.id = _order_id;
    END IF;

    INSERT INTO public.historian (
      entity_type, entity_id, action, changed_fields,
      project_id, order_id, sample_id, order_measurement_id,
      changed_by, actor_source, db_role
    ) VALUES (
      _entity, (_row ->> 'id')::uuid, lower(TG_OP), _fields,
      _project_id, _order_id, _sample_id, _om_id,
      _uid, CASE WHEN _uid IS NULL THEN 'system' ELSE 'user' END,
      session_user
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'historian: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.historian_log_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_historian_projects
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.historian_log_change('project');

CREATE TRIGGER trg_historian_measurement_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.measurement_orders
  FOR EACH ROW EXECUTE FUNCTION public.historian_log_change('order');

CREATE TRIGGER trg_historian_samples
  AFTER INSERT OR UPDATE OR DELETE ON public.samples
  FOR EACH ROW EXECUTE FUNCTION public.historian_log_change('sample');

CREATE TRIGGER trg_historian_order_measurements
  AFTER INSERT OR UPDATE OR DELETE ON public.order_measurements
  FOR EACH ROW EXECUTE FUNCTION public.historian_log_change('order_measurement');

CREATE FUNCTION public.historian_purge_retention()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted integer := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('public.historian_purge_retention')) THEN
    RETURN 0;
  END IF;
  DELETE FROM public.historian
  WHERE id IN (
    SELECT id FROM public.historian
    WHERE occurred_at < now() - interval '365 days'
    ORDER BY occurred_at
    LIMIT 2000
  );
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.historian_purge_retention() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.historian_purge_retention() TO service_role;

CREATE FUNCTION public.admin_purge_historian_retention()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'master') THEN
    RAISE EXCEPTION 'Nur Master dürfen die Bereinigung ausführen.' USING ERRCODE = '42501';
  END IF;
  RETURN public.historian_purge_retention();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_purge_historian_retention() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_purge_historian_retention() TO authenticated;