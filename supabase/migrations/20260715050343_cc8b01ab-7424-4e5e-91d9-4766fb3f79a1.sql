
-- 1) Extend portfolio_work_packages
ALTER TABLE public.portfolio_work_packages
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS budget NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'geplant',
  ADD COLUMN IF NOT EXISTS responsible_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2) Extend portfolio_tasks
ALTER TABLE public.portfolio_tasks
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS planned_effort_hours NUMERIC(10,2);

-- 3) Mapping Förder-AP <-> Projekt-AP
CREATE TABLE IF NOT EXISTS public.portfolio_wp_project_wp_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_work_package_id UUID NOT NULL REFERENCES public.portfolio_work_packages(id) ON DELETE CASCADE,
  project_work_package_id UUID NOT NULL REFERENCES public.project_work_packages(id) ON DELETE CASCADE,
  funding_relevant BOOLEAN NOT NULL DEFAULT TRUE,
  funding_share_pct NUMERIC(5,2) NOT NULL DEFAULT 100,
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (portfolio_work_package_id, project_work_package_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_wp_project_wp_map TO authenticated;
GRANT ALL ON public.portfolio_wp_project_wp_map TO service_role;
ALTER TABLE public.portfolio_wp_project_wp_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read pwp_ppwp map" ON public.portfolio_wp_project_wp_map
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "write pwp_ppwp map (master/pmo)" ON public.portfolio_wp_project_wp_map
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'master')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.custom_roles cr ON cr.id = ur.custom_role_id
      WHERE ur.user_id = auth.uid() AND lower(cr.name) = 'pmo'
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'master')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.custom_roles cr ON cr.id = ur.custom_role_id
      WHERE ur.user_id = auth.uid() AND lower(cr.name) = 'pmo'
    )
  );

-- 4) Mapping Förder-Task <-> Projekt-AP
CREATE TABLE IF NOT EXISTS public.portfolio_task_project_wp_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_task_id UUID NOT NULL REFERENCES public.portfolio_tasks(id) ON DELETE CASCADE,
  project_work_package_id UUID NOT NULL REFERENCES public.project_work_packages(id) ON DELETE CASCADE,
  funding_relevant BOOLEAN NOT NULL DEFAULT TRUE,
  funding_share_pct NUMERIC(5,2) NOT NULL DEFAULT 100,
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (portfolio_task_id, project_work_package_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_task_project_wp_map TO authenticated;
GRANT ALL ON public.portfolio_task_project_wp_map TO service_role;
ALTER TABLE public.portfolio_task_project_wp_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read pt_ppwp map" ON public.portfolio_task_project_wp_map
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "write pt_ppwp map (master/pmo)" ON public.portfolio_task_project_wp_map
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'master')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.custom_roles cr ON cr.id = ur.custom_role_id
      WHERE ur.user_id = auth.uid() AND lower(cr.name) = 'pmo'
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'master')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.custom_roles cr ON cr.id = ur.custom_role_id
      WHERE ur.user_id = auth.uid() AND lower(cr.name) = 'pmo'
    )
  );

-- 5) Audit-Log
CREATE TABLE IF NOT EXISTS public.portfolio_structure_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- 'portfolio_work_package' | 'portfolio_task' | 'wp_project_wp_map' | 'task_project_wp_map'
  entity_id UUID NOT NULL,
  portfolio_id UUID,
  action TEXT NOT NULL, -- INSERT | UPDATE | DELETE
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  old_data JSONB,
  new_data JSONB
);

GRANT SELECT, INSERT ON public.portfolio_structure_audit_log TO authenticated;
GRANT ALL ON public.portfolio_structure_audit_log TO service_role;
ALTER TABLE public.portfolio_structure_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read portfolio audit" ON public.portfolio_structure_audit_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert portfolio audit (any auth)" ON public.portfolio_structure_audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_portfolio_audit_entity
  ON public.portfolio_structure_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_audit_portfolio
  ON public.portfolio_structure_audit_log(portfolio_id);

-- 6) Audit trigger function (generic)
CREATE OR REPLACE FUNCTION public.trg_portfolio_structure_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_type TEXT := TG_ARGV[0];
  v_portfolio_id UUID;
  v_entity_id UUID;
  v_old JSONB;
  v_new JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_entity_id := (v_old->>'id')::uuid;
  ELSE
    v_new := to_jsonb(NEW);
    v_entity_id := (v_new->>'id')::uuid;
    IF TG_OP = 'UPDATE' THEN v_old := to_jsonb(OLD); END IF;
  END IF;

  -- Determine portfolio_id
  IF v_entity_type = 'portfolio_work_package' THEN
    v_portfolio_id := COALESCE((v_new->>'portfolio_id')::uuid, (v_old->>'portfolio_id')::uuid);
  ELSIF v_entity_type = 'portfolio_task' THEN
    SELECT pwp.portfolio_id INTO v_portfolio_id
    FROM public.portfolio_work_packages pwp
    WHERE pwp.id = COALESCE((v_new->>'portfolio_work_package_id')::uuid, (v_old->>'portfolio_work_package_id')::uuid);
  ELSIF v_entity_type = 'wp_project_wp_map' THEN
    SELECT pwp.portfolio_id INTO v_portfolio_id
    FROM public.portfolio_work_packages pwp
    WHERE pwp.id = COALESCE((v_new->>'portfolio_work_package_id')::uuid, (v_old->>'portfolio_work_package_id')::uuid);
  ELSIF v_entity_type = 'task_project_wp_map' THEN
    SELECT pwp.portfolio_id INTO v_portfolio_id
    FROM public.portfolio_tasks pt
    JOIN public.portfolio_work_packages pwp ON pwp.id = pt.portfolio_work_package_id
    WHERE pt.id = COALESCE((v_new->>'portfolio_task_id')::uuid, (v_old->>'portfolio_task_id')::uuid);
  END IF;

  INSERT INTO public.portfolio_structure_audit_log
    (entity_type, entity_id, portfolio_id, action, changed_by, old_data, new_data)
  VALUES
    (v_entity_type, v_entity_id, v_portfolio_id, TG_OP, auth.uid(), v_old, v_new);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_portfolio_wp ON public.portfolio_work_packages;
CREATE TRIGGER trg_audit_portfolio_wp
  AFTER INSERT OR UPDATE OR DELETE ON public.portfolio_work_packages
  FOR EACH ROW EXECUTE FUNCTION public.trg_portfolio_structure_audit('portfolio_work_package');

DROP TRIGGER IF EXISTS trg_audit_portfolio_task ON public.portfolio_tasks;
CREATE TRIGGER trg_audit_portfolio_task
  AFTER INSERT OR UPDATE OR DELETE ON public.portfolio_tasks
  FOR EACH ROW EXECUTE FUNCTION public.trg_portfolio_structure_audit('portfolio_task');

DROP TRIGGER IF EXISTS trg_audit_wp_map ON public.portfolio_wp_project_wp_map;
CREATE TRIGGER trg_audit_wp_map
  AFTER INSERT OR UPDATE OR DELETE ON public.portfolio_wp_project_wp_map
  FOR EACH ROW EXECUTE FUNCTION public.trg_portfolio_structure_audit('wp_project_wp_map');

DROP TRIGGER IF EXISTS trg_audit_task_map ON public.portfolio_task_project_wp_map;
CREATE TRIGGER trg_audit_task_map
  AFTER INSERT OR UPDATE OR DELETE ON public.portfolio_task_project_wp_map
  FOR EACH ROW EXECUTE FUNCTION public.trg_portfolio_structure_audit('task_project_wp_map');

-- 7) updated_at triggers on new tables
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_pwp_map ON public.portfolio_wp_project_wp_map;
CREATE TRIGGER set_updated_at_pwp_map
  BEFORE UPDATE ON public.portfolio_wp_project_wp_map
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_pt_map ON public.portfolio_task_project_wp_map;
CREATE TRIGGER set_updated_at_pt_map
  BEFORE UPDATE ON public.portfolio_task_project_wp_map
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 8) Convenience view: unassigned project work packages (no funding mapping)
CREATE OR REPLACE VIEW public.v_project_wp_without_funding AS
SELECT pwp.id AS project_work_package_id,
       pwp.project_id,
       pwp.title,
       pwp.status,
       pwp.start_date,
       pwp.end_date
FROM public.project_work_packages pwp
WHERE NOT EXISTS (
  SELECT 1 FROM public.portfolio_wp_project_wp_map m
  WHERE m.project_work_package_id = pwp.id AND m.funding_relevant = TRUE
);

GRANT SELECT ON public.v_project_wp_without_funding TO authenticated;
