
-- Phase 1: Workflow & Form architecture foundation
-- Keep existing tables intact for backward compatibility.

-- =========================================================================
-- 1. service_forms — Formulare als eigenständige Entität
-- =========================================================================
CREATE TABLE public.service_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NULL REFERENCES public.measurement_services(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  form_type TEXT NOT NULL DEFAULT 'generic',
  is_global BOOLEAN NOT NULL DEFAULT false,
  schema JSONB NOT NULL DEFAULT '{"fields": []}'::jsonb,
  layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  archived_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_forms TO authenticated;
GRANT ALL ON public.service_forms TO service_role;

ALTER TABLE public.service_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read forms" ON public.service_forms
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Masters manage forms" ON public.service_forms
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

-- =========================================================================
-- 2. service_workflow_definitions — Workflow pro Service (versioniert)
-- =========================================================================
CREATE TABLE public.service_workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.measurement_services(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Standard-Workflow',
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  graph JSONB NOT NULL DEFAULT '{"nodes": [], "edges": []}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service_id, version)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_workflow_definitions TO authenticated;
GRANT ALL ON public.service_workflow_definitions TO service_role;

ALTER TABLE public.service_workflow_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read workflows" ON public.service_workflow_definitions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Masters manage workflows" ON public.service_workflow_definitions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

-- =========================================================================
-- 3. service_workflow_steps — einzelne Prozessschritte
-- =========================================================================
CREATE TABLE public.service_workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.service_workflow_definitions(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  step_type TEXT NOT NULL DEFAULT 'form',
  role_required TEXT,
  assignee_user_id UUID REFERENCES auth.users(id),
  form_id UUID REFERENCES public.service_forms(id) ON DELETE SET NULL,
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  condition_expr JSONB NOT NULL DEFAULT '{}'::jsonb,
  due_hours INTEGER,
  escalation_role TEXT,
  auto_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  notify_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, step_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_workflow_steps TO authenticated;
GRANT ALL ON public.service_workflow_steps TO service_role;

ALTER TABLE public.service_workflow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read steps" ON public.service_workflow_steps
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Masters manage steps" ON public.service_workflow_steps
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

-- =========================================================================
-- 4. order_workflow_instances — laufende Workflow-Instanz pro Auftrag
-- =========================================================================
CREATE TABLE public.order_workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.measurement_orders(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES public.service_workflow_definitions(id) ON DELETE RESTRICT,
  workflow_version INTEGER NOT NULL,
  current_step_id UUID REFERENCES public.service_workflow_steps(id),
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_workflow_instances TO authenticated;
GRANT ALL ON public.order_workflow_instances TO service_role;

ALTER TABLE public.order_workflow_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read instances" ON public.order_workflow_instances
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Masters manage instances" ON public.order_workflow_instances
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

-- =========================================================================
-- 5. order_workflow_tasks — konkrete Aufgabe pro Schritt
-- =========================================================================
CREATE TABLE public.order_workflow_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.order_workflow_instances(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.service_workflow_steps(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES public.measurement_orders(id) ON DELETE CASCADE,
  form_id UUID REFERENCES public.service_forms(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id),
  assigned_role TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT DEFAULT 'normal',
  due_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  form_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_owt_assigned ON public.order_workflow_tasks(assigned_to, status);
CREATE INDEX idx_owt_order ON public.order_workflow_tasks(order_id);
CREATE INDEX idx_owt_instance ON public.order_workflow_tasks(instance_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_workflow_tasks TO authenticated;
GRANT ALL ON public.order_workflow_tasks TO service_role;

ALTER TABLE public.order_workflow_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own or masters" ON public.order_workflow_tasks
  FOR SELECT TO authenticated
  USING (
    assigned_to = auth.uid()
    OR public.has_role(auth.uid(), 'master')
    OR public.has_role(auth.uid(), 'durchfuehrer')
    OR public.has_role(auth.uid(), 'auftraggeber')
  );
CREATE POLICY "Update own tasks" ON public.order_workflow_tasks
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR public.has_role(auth.uid(), 'master'))
  WITH CHECK (assigned_to = auth.uid() OR public.has_role(auth.uid(), 'master'));
CREATE POLICY "Masters insert/delete tasks" ON public.order_workflow_tasks
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'master'));
CREATE POLICY "Masters delete tasks" ON public.order_workflow_tasks
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'master'));

-- =========================================================================
-- updated_at Trigger
-- =========================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_sf_updated BEFORE UPDATE ON public.service_forms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_swd_updated BEFORE UPDATE ON public.service_workflow_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sws_updated BEFORE UPDATE ON public.service_workflow_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_owi_updated BEFORE UPDATE ON public.order_workflow_instances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_owt_updated BEFORE UPDATE ON public.order_workflow_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- Migration: Default-Workflow für bestehende Services anlegen
-- =========================================================================
DO $$
DECLARE
  svc RECORD;
  wf_id UUID;
  auftrag_form UUID;
  messung_form UUID;
  bericht_form UUID;
BEGIN
  FOR svc IN SELECT id, service_name FROM public.measurement_services LOOP
    -- Formulare
    INSERT INTO public.service_forms (service_id, name, form_type)
    VALUES (svc.id, 'Auftraggeberformular', 'requester')
    RETURNING id INTO auftrag_form;

    INSERT INTO public.service_forms (service_id, name, form_type)
    VALUES (svc.id, 'Messdienstleisterformular', 'provider')
    RETURNING id INTO messung_form;

    INSERT INTO public.service_forms (service_id, name, form_type)
    VALUES (svc.id, 'Ergebnisbericht', 'report')
    RETURNING id INTO bericht_form;

    -- Workflow-Definition
    INSERT INTO public.service_workflow_definitions (service_id, name, version, is_active)
    VALUES (svc.id, 'Standard-Workflow', 1, true)
    RETURNING id INTO wf_id;

    -- Schritte
    INSERT INTO public.service_workflow_steps
      (workflow_id, step_key, name, step_type, role_required, form_id, order_index, is_mandatory)
    VALUES
      (wf_id, 'requester_form', 'Auftraggeberformular', 'form', 'auftraggeber', auftrag_form, 10, true),
      (wf_id, 'provider_form',  'Messdienstleisterformular', 'form', 'durchfuehrer', messung_form, 20, true),
      (wf_id, 'report',         'Ergebnisbericht', 'form', 'durchfuehrer', bericht_form, 30, true),
      (wf_id, 'complete',       'Auftrag abschließen', 'end', 'master', NULL, 40, true);
  END LOOP;
END $$;
