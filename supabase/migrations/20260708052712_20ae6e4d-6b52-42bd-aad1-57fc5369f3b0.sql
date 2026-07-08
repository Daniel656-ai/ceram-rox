
-- ============================================================
-- Enums
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.order_kind AS ENUM ('pilot_plant','labor','combined','legacy');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.masse_type AS ENUM ('DK','GK','KK','MK','PK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.workflow_status AS ENUM (
    'entwurf','geplant','pp_in_progress','pp_completed',
    'samples_created','waiting_analysis','analysis_in_progress',
    'results_complete','abgeschlossen'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- measurement_orders: neue Spalten
-- ============================================================
ALTER TABLE public.measurement_orders
  ADD COLUMN IF NOT EXISTS order_kind public.order_kind NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS workflow_status public.workflow_status,
  ADD COLUMN IF NOT EXISTS pp_experiment_number text,
  ADD COLUMN IF NOT EXISTS pp_v2o5_percent numeric,
  ADD COLUMN IF NOT EXISTS pp_experiment_date date,
  ADD COLUMN IF NOT EXISTS pp_issuer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pp_previous_experiments text,
  ADD COLUMN IF NOT EXISTS pp_experiment_kind text,
  ADD COLUMN IF NOT EXISTS pp_masse_type public.masse_type,
  ADD COLUMN IF NOT EXISTS pp_remarks text;

-- ============================================================
-- samples: order_id
-- ============================================================
ALTER TABLE public.samples
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.measurement_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_samples_order_id ON public.samples(order_id);

-- ============================================================
-- order_measurements: analysis_request_id
-- ============================================================
ALTER TABLE public.order_measurements
  ADD COLUMN IF NOT EXISTS analysis_request_id uuid;

-- ============================================================
-- order_analysis_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_analysis_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.measurement_orders(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.measurement_services(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_order_analysis_requests_order ON public.order_analysis_requests(order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_analysis_requests TO authenticated;
GRANT ALL ON public.order_analysis_requests TO service_role;

ALTER TABLE public.order_analysis_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read analysis requests"
  ON public.order_analysis_requests FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "auth insert analysis requests"
  ON public.order_analysis_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(),'master'::app_role)
    OR has_permission(auth.uid(),'orders.create')
    OR has_permission(auth.uid(),'orders.edit')
  );

CREATE POLICY "auth update analysis requests"
  ON public.order_analysis_requests FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(),'master'::app_role)
    OR has_permission(auth.uid(),'orders.edit')
  );

CREATE POLICY "auth delete analysis requests"
  ON public.order_analysis_requests FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(),'master'::app_role)
    OR has_permission(auth.uid(),'orders.edit')
  );

-- FK for order_measurements.analysis_request_id (add after table exists)
DO $$ BEGIN
  ALTER TABLE public.order_measurements
    ADD CONSTRAINT order_measurements_analysis_request_id_fkey
    FOREIGN KEY (analysis_request_id)
    REFERENCES public.order_analysis_requests(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- updated_at trigger
CREATE TRIGGER trg_order_analysis_requests_updated_at
BEFORE UPDATE ON public.order_analysis_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Workflow-Status Recompute
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_order_workflow_status(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind order_kind;
  v_current workflow_status;
  v_new workflow_status;
  v_pp_has_data boolean;
  v_pp_completed boolean;
  v_samples int;
  v_assigned int;
  v_in_progress int;
  v_open int;
  v_total int;
BEGIN
  SELECT order_kind, workflow_status INTO v_kind, v_current
    FROM measurement_orders WHERE id = _order_id;

  IF v_kind IS NULL OR v_kind = 'legacy' THEN RETURN; END IF;

  -- Manual completion is respected
  IF v_current = 'abgeschlossen' THEN RETURN; END IF;

  SELECT
    (pp_experiment_number IS NOT NULL
      OR pp_v2o5_percent IS NOT NULL
      OR pp_masse_type IS NOT NULL
      OR pp_experiment_kind IS NOT NULL),
    (pp_experiment_date IS NOT NULL)
  INTO v_pp_has_data, v_pp_completed
  FROM measurement_orders WHERE id = _order_id;

  SELECT count(*) INTO v_samples FROM samples WHERE order_id = _order_id;

  SELECT
    count(*) FILTER (WHERE analysis_request_id IS NOT NULL OR order_id = _order_id),
    count(*) FILTER (WHERE status = 'in_progress'),
    count(*) FILTER (WHERE status <> 'completed'),
    count(*)
  INTO v_assigned, v_in_progress, v_open, v_total
  FROM order_measurements
  WHERE order_id = _order_id;

  -- Priority order (highest wins)
  IF v_total > 0 AND v_open = 0 THEN
    v_new := 'results_complete';
  ELSIF v_in_progress > 0 THEN
    v_new := 'analysis_in_progress';
  ELSIF v_assigned > 0 THEN
    v_new := 'waiting_analysis';
  ELSIF v_samples > 0 THEN
    v_new := 'samples_created';
  ELSIF v_pp_completed THEN
    v_new := 'pp_completed';
  ELSIF v_pp_has_data THEN
    v_new := 'pp_in_progress';
  ELSE
    v_new := COALESCE(v_current, 'entwurf');
  END IF;

  IF v_new IS DISTINCT FROM v_current THEN
    UPDATE measurement_orders SET workflow_status = v_new WHERE id = _order_id;
  END IF;
END $$;

-- Trigger functions
CREATE OR REPLACE FUNCTION public.trg_recompute_workflow_from_orders()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_order_workflow_status(COALESCE(NEW.id, OLD.id));
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.trg_recompute_workflow_from_measurements()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_order_workflow_status(COALESCE(NEW.order_id, OLD.order_id));
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.trg_recompute_workflow_from_samples()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.order_id IS NOT NULL THEN
    PERFORM public.recompute_order_workflow_status(NEW.order_id);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.order_id IS NOT NULL AND OLD.order_id IS DISTINCT FROM NEW.order_id THEN
    PERFORM public.recompute_order_workflow_status(OLD.order_id);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.trg_recompute_workflow_from_requests()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_order_workflow_status(COALESCE(NEW.order_id, OLD.order_id));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_workflow_orders ON public.measurement_orders;
CREATE TRIGGER trg_workflow_orders
AFTER INSERT OR UPDATE OF pp_experiment_number, pp_v2o5_percent, pp_experiment_date,
  pp_masse_type, pp_experiment_kind, order_kind
ON public.measurement_orders
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_workflow_from_orders();

DROP TRIGGER IF EXISTS trg_workflow_measurements ON public.order_measurements;
CREATE TRIGGER trg_workflow_measurements
AFTER INSERT OR UPDATE OF status OR DELETE
ON public.order_measurements
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_workflow_from_measurements();

DROP TRIGGER IF EXISTS trg_workflow_samples ON public.samples;
CREATE TRIGGER trg_workflow_samples
AFTER INSERT OR UPDATE OF order_id OR DELETE
ON public.samples
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_workflow_from_samples();

DROP TRIGGER IF EXISTS trg_workflow_requests ON public.order_analysis_requests;
CREATE TRIGGER trg_workflow_requests
AFTER INSERT OR UPDATE OR DELETE
ON public.order_analysis_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_workflow_from_requests();

-- ============================================================
-- RPC: assign analysis request to sample
-- ============================================================
CREATE OR REPLACE FUNCTION public.assign_analysis_request_to_sample(
  _request_id uuid,
  _sample_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_req order_analysis_requests%ROWTYPE;
  v_new_measurement_id uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'orders.edit')) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;

  SELECT * INTO v_req FROM order_analysis_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Anforderung nicht gefunden'; END IF;

  INSERT INTO order_measurements (order_id, service_id, status, analysis_request_id)
  VALUES (v_req.order_id, v_req.service_id, 'open', _request_id)
  RETURNING id INTO v_new_measurement_id;

  -- Link sample via measurement_orders.sample_id is per-order; new samples path uses samples.order_id.
  -- The measurement is attached to the request; the sample linkage is captured on the samples table
  -- (samples.order_id) — join at read time by matching order_id.
  RETURN v_new_measurement_id;
END $$;

GRANT EXECUTE ON FUNCTION public.assign_analysis_request_to_sample(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_order_workflow_status(uuid) TO authenticated;

-- ============================================================
-- Initial workflow_status for newly created non-legacy orders
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_initial_workflow_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.order_kind IS NOT NULL AND NEW.order_kind <> 'legacy'
     AND NEW.workflow_status IS NULL THEN
    NEW.workflow_status := 'entwurf';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_initial_workflow_status ON public.measurement_orders;
CREATE TRIGGER trg_set_initial_workflow_status
BEFORE INSERT ON public.measurement_orders
FOR EACH ROW EXECUTE FUNCTION public.set_initial_workflow_status();
