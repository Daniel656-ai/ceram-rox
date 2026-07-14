
-- =====================================================================
-- PHASE 1: Canonical Process/Service Designer schema (retry)
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE public.process_template_kind AS ENUM ('labor', 'pilot_plant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.process_template_scope AS ENUM ('template', 'snippet', 'global');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.form_scope AS ENUM ('template', 'global');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.order_instance_status AS ENUM
    ('draft','planned','in_progress','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.order_workflow_status_new AS ENUM
    ('entwurf','geplant','in_progress','waiting','review','abgeschlossen','abgebrochen');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.step_run_status AS ENUM
    ('pending','in_progress','completed','skipped','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.step_position_status AS ENUM
    ('open','in_progress','completed','not_feasible');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Designer permission helper (only 'master' role exists in app_role today).
CREATE OR REPLACE FUNCTION public.can_manage_designer(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_uid, 'master'::app_role);
$$;

-- 1) process_templates
CREATE TABLE public.process_templates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  description    text,
  kind           public.process_template_kind NOT NULL,
  scope          public.process_template_scope NOT NULL DEFAULT 'template',
  category       text,
  version        integer NOT NULL DEFAULT 1,
  is_active      boolean NOT NULL DEFAULT true,
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  legacy_service_id  uuid,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX process_templates_kind_idx ON public.process_templates(kind) WHERE is_active;
CREATE INDEX process_templates_scope_idx ON public.process_templates(scope);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.process_templates TO authenticated;
GRANT ALL ON public.process_templates TO service_role;
ALTER TABLE public.process_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates readable" ON public.process_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "templates insert" ON public.process_templates FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_designer(auth.uid()));
CREATE POLICY "templates update" ON public.process_templates FOR UPDATE TO authenticated
  USING (public.can_manage_designer(auth.uid()))
  WITH CHECK (public.can_manage_designer(auth.uid()));
CREATE POLICY "templates delete" ON public.process_templates FOR DELETE TO authenticated
  USING (public.can_manage_designer(auth.uid()));

CREATE TRIGGER trg_process_templates_touch
  BEFORE UPDATE ON public.process_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) form_definitions
CREATE TABLE public.form_definitions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  description    text,
  scope          public.form_scope NOT NULL DEFAULT 'template',
  version        integer NOT NULL DEFAULT 1,
  layout         jsonb NOT NULL DEFAULT '{}'::jsonb,
  archived_at    timestamptz,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX form_definitions_scope_idx ON public.form_definitions(scope) WHERE archived_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_definitions TO authenticated;
GRANT ALL ON public.form_definitions TO service_role;
ALTER TABLE public.form_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forms readable" ON public.form_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "forms insert" ON public.form_definitions FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_designer(auth.uid()));
CREATE POLICY "forms update" ON public.form_definitions FOR UPDATE TO authenticated
  USING (public.can_manage_designer(auth.uid()))
  WITH CHECK (public.can_manage_designer(auth.uid()));
CREATE POLICY "forms delete" ON public.form_definitions FOR DELETE TO authenticated
  USING (public.can_manage_designer(auth.uid()));

CREATE TRIGGER trg_form_definitions_touch
  BEFORE UPDATE ON public.form_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) form_fields
CREATE TABLE public.form_fields (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id           uuid NOT NULL REFERENCES public.form_definitions(id) ON DELETE CASCADE,
  field_key         text NOT NULL,
  display_name      text NOT NULL,
  description       text,
  field_type        text NOT NULL,
  category          text,
  unit              text,
  is_required       boolean NOT NULL DEFAULT false,
  default_value     text,
  validation        jsonb NOT NULL DEFAULT '{}'::jsonb,
  min_value         numeric,
  max_value         numeric,
  decimal_places    integer,
  readonly          boolean NOT NULL DEFAULT false,
  formula           text,
  select_options    jsonb NOT NULL DEFAULT '[]'::jsonb,
  ref_target        text,
  parent_field_id   uuid REFERENCES public.form_fields(id) ON DELETE CASCADE,
  sort_order        integer NOT NULL DEFAULT 0,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (form_id, field_key)
);
CREATE INDEX form_fields_form_idx ON public.form_fields(form_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_fields TO authenticated;
GRANT ALL ON public.form_fields TO service_role;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fields readable" ON public.form_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "fields insert" ON public.form_fields FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_designer(auth.uid()));
CREATE POLICY "fields update" ON public.form_fields FOR UPDATE TO authenticated
  USING (public.can_manage_designer(auth.uid()))
  WITH CHECK (public.can_manage_designer(auth.uid()));
CREATE POLICY "fields delete" ON public.form_fields FOR DELETE TO authenticated
  USING (public.can_manage_designer(auth.uid()));

CREATE TRIGGER trg_form_fields_touch
  BEFORE UPDATE ON public.form_fields
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) process_steps
CREATE TABLE public.process_steps (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id        uuid NOT NULL REFERENCES public.process_templates(id) ON DELETE CASCADE,
  step_key           text NOT NULL,
  name               text NOT NULL,
  description        text,
  order_index        integer NOT NULL DEFAULT 0,
  form_id            uuid REFERENCES public.form_definitions(id) ON DELETE SET NULL,
  role_required      text,
  assignee_rule      jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_mandatory       boolean NOT NULL DEFAULT true,
  condition_expr     jsonb NOT NULL DEFAULT '{}'::jsonb,
  auto_actions       jsonb NOT NULL DEFAULT '[]'::jsonb,
  due_hours          integer,
  escalation_role    text,
  position_source    text,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, step_key)
);
CREATE INDEX process_steps_tpl_idx ON public.process_steps(template_id, order_index);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.process_steps TO authenticated;
GRANT ALL ON public.process_steps TO service_role;
ALTER TABLE public.process_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "steps readable" ON public.process_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "steps insert" ON public.process_steps FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_designer(auth.uid()));
CREATE POLICY "steps update" ON public.process_steps FOR UPDATE TO authenticated
  USING (public.can_manage_designer(auth.uid()))
  WITH CHECK (public.can_manage_designer(auth.uid()));
CREATE POLICY "steps delete" ON public.process_steps FOR DELETE TO authenticated
  USING (public.can_manage_designer(auth.uid()));

CREATE TRIGGER trg_process_steps_touch
  BEFORE UPDATE ON public.process_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) order_instances
CREATE TABLE public.order_instances (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number        text UNIQUE,
  template_id         uuid REFERENCES public.process_templates(id) ON DELETE SET NULL,
  template_snapshot   jsonb NOT NULL DEFAULT '{}'::jsonb,
  project_id          uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  title               text,
  status              public.order_instance_status NOT NULL DEFAULT 'draft',
  workflow_status     public.order_workflow_status_new NOT NULL DEFAULT 'entwurf',
  shared_data         jsonb NOT NULL DEFAULT '{}'::jsonb,
  sample_ids          uuid[] NOT NULL DEFAULT '{}',
  legacy_order_id     uuid,
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  locked_at           timestamptz,
  completed_at        timestamptz,
  due_date            date,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_instances_project_idx ON public.order_instances(project_id);
CREATE INDEX order_instances_template_idx ON public.order_instances(template_id);
CREATE INDEX order_instances_status_idx ON public.order_instances(workflow_status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_instances TO authenticated;
GRANT ALL ON public.order_instances TO service_role;
ALTER TABLE public.order_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_instances readable" ON public.order_instances FOR SELECT TO authenticated USING (true);
CREATE POLICY "order_instances insert" ON public.order_instances FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "order_instances update" ON public.order_instances FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'master'::app_role));
CREATE POLICY "order_instances delete" ON public.order_instances FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'master'::app_role));

CREATE TRIGGER trg_order_instances_touch
  BEFORE UPDATE ON public.order_instances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6) order_step_runs
CREATE TABLE public.order_step_runs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           uuid NOT NULL REFERENCES public.order_instances(id) ON DELETE CASCADE,
  step_id            uuid REFERENCES public.process_steps(id) ON DELETE SET NULL,
  step_key           text NOT NULL,
  step_snapshot      jsonb NOT NULL DEFAULT '{}'::jsonb,
  order_index        integer NOT NULL DEFAULT 0,
  status             public.step_run_status NOT NULL DEFAULT 'pending',
  assigned_to        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_role      text,
  form_response      jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes              text,
  opened_at          timestamptz,
  opened_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at       timestamptz,
  completed_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  time_entry_id      uuid,
  auto_time_minutes  integer,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_step_runs_order_idx ON public.order_step_runs(order_id, order_index);
CREATE INDEX order_step_runs_assignee_idx ON public.order_step_runs(assigned_to)
  WHERE status IN ('pending','in_progress');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_step_runs TO authenticated;
GRANT ALL ON public.order_step_runs TO service_role;
ALTER TABLE public.order_step_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "step_runs readable" ON public.order_step_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "step_runs insert" ON public.order_step_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "step_runs update" ON public.order_step_runs FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    OR public.has_role(auth.uid(), 'master'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.order_instances oi
      WHERE oi.id = order_step_runs.order_id AND oi.created_by = auth.uid()
    )
  )
  WITH CHECK (true);
CREATE POLICY "step_runs delete" ON public.order_step_runs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'master'::app_role));

CREATE TRIGGER trg_order_step_runs_touch
  BEFORE UPDATE ON public.order_step_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7) order_step_positions
CREATE TABLE public.order_step_positions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_run_id           uuid NOT NULL REFERENCES public.order_step_runs(id) ON DELETE CASCADE,
  position_ref          text,
  sample_id             uuid REFERENCES public.samples(id) ON DELETE SET NULL,
  label                 text,
  status                public.step_position_status NOT NULL DEFAULT 'open',
  result_value          text,
  result_data           jsonb NOT NULL DEFAULT '{}'::jsonb,
  remarks               text,
  not_feasible_reason   text,
  completed_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_step_positions_run_idx ON public.order_step_positions(step_run_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_step_positions TO authenticated;
GRANT ALL ON public.order_step_positions TO service_role;
ALTER TABLE public.order_step_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "positions readable" ON public.order_step_positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "positions insert" ON public.order_step_positions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "positions update" ON public.order_step_positions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.order_step_runs r
      LEFT JOIN public.order_instances oi ON oi.id = r.order_id
      WHERE r.id = order_step_positions.step_run_id
        AND (r.assigned_to = auth.uid()
             OR oi.created_by = auth.uid()
             OR public.has_role(auth.uid(), 'master'::app_role))
    )
  )
  WITH CHECK (true);
CREATE POLICY "positions delete" ON public.order_step_positions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'master'::app_role));

CREATE TRIGGER trg_order_step_positions_touch
  BEFORE UPDATE ON public.order_step_positions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8) Write-lock trigger for completed orders
CREATE OR REPLACE FUNCTION public.assert_order_instance_unlocked()
RETURNS TRIGGER AS $$
DECLARE
  v_order  uuid;
  v_locked timestamptz;
BEGIN
  IF current_setting('app.bypass_order_lock', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'order_instances' THEN
    IF TG_OP = 'UPDATE' AND OLD.locked_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Auftrag ist abgeschlossen und schreibgeschützt';
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'order_step_runs' THEN
    v_order := COALESCE(NEW.order_id, OLD.order_id);
  ELSIF TG_TABLE_NAME = 'order_step_positions' THEN
    SELECT r.order_id INTO v_order FROM public.order_step_runs r
    WHERE r.id = COALESCE(NEW.step_run_id, OLD.step_run_id);
  END IF;

  IF v_order IS NOT NULL THEN
    SELECT locked_at INTO v_locked FROM public.order_instances WHERE id = v_order;
    IF v_locked IS NOT NULL THEN
      RAISE EXCEPTION 'Auftrag ist abgeschlossen und schreibgeschützt';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_lock_order_instances
  BEFORE UPDATE OR DELETE ON public.order_instances
  FOR EACH ROW EXECUTE FUNCTION public.assert_order_instance_unlocked();

CREATE TRIGGER trg_lock_order_step_runs
  BEFORE INSERT OR UPDATE OR DELETE ON public.order_step_runs
  FOR EACH ROW EXECUTE FUNCTION public.assert_order_instance_unlocked();

CREATE TRIGGER trg_lock_order_step_positions
  BEFORE INSERT OR UPDATE OR DELETE ON public.order_step_positions
  FOR EACH ROW EXECUTE FUNCTION public.assert_order_instance_unlocked();
