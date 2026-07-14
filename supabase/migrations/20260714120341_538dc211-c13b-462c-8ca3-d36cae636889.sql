
-- ============================================================
-- FFG-konformes Portfolio-/Arbeitspaket-Management  (Phase 1: DB)
-- ============================================================

-- 1) Kategorien
CREATE TABLE public.work_package_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.work_package_categories TO authenticated;
GRANT ALL ON public.work_package_categories TO service_role;
ALTER TABLE public.work_package_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wpc_select" ON public.work_package_categories FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "wpc_write" ON public.work_package_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'master'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'master'::app_role));
CREATE TRIGGER trg_wpc_touch BEFORE UPDATE ON public.work_package_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.work_package_categories (name, sort_order, is_system) VALUES
  ('Projektmanagement', 10, true),
  ('Grundlagen & Charakterisierung', 20, true),
  ('TE-Versuche / Prototypen', 30, true),
  ('PV-Versuche / Produktionsversuche', 40, true),
  ('Feldversuche', 50, true);

-- 2) Portfolio-Arbeitspakete & Tasks
CREATE TABLE public.portfolio_work_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.project_portfolios(id) ON DELETE CASCADE,
  code text,
  name text NOT NULL,
  description text,
  category_id uuid REFERENCES public.work_package_categories(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pwp_portfolio ON public.portfolio_work_packages(portfolio_id);
CREATE INDEX idx_pwp_category ON public.portfolio_work_packages(category_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_work_packages TO authenticated;
GRANT ALL ON public.portfolio_work_packages TO service_role;
ALTER TABLE public.portfolio_work_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pwp_select" ON public.portfolio_work_packages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'portfolios.view'));
CREATE POLICY "pwp_write" ON public.portfolio_work_packages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'portfolios.manage'))
  WITH CHECK (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'portfolios.manage'));
CREATE TRIGGER trg_pwp_touch BEFORE UPDATE ON public.portfolio_work_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.portfolio_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_work_package_id uuid NOT NULL REFERENCES public.portfolio_work_packages(id) ON DELETE CASCADE,
  code text,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ptask_wp ON public.portfolio_tasks(portfolio_work_package_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_tasks TO authenticated;
GRANT ALL ON public.portfolio_tasks TO service_role;
ALTER TABLE public.portfolio_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ptask_select" ON public.portfolio_tasks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'portfolios.view'));
CREATE POLICY "ptask_write" ON public.portfolio_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'portfolios.manage'))
  WITH CHECK (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'portfolios.manage'));
CREATE TRIGGER trg_ptask_touch BEFORE UPDATE ON public.portfolio_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) 1:1 Projekt → Portfolio
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS portfolio_id uuid
  REFERENCES public.project_portfolios(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_portfolio ON public.projects(portfolio_id);

WITH picks AS (
  SELECT DISTINCT ON (project_id) project_id, portfolio_id
  FROM public.project_portfolio_members
  ORDER BY project_id, created_at ASC
)
UPDATE public.projects p SET portfolio_id = picks.portfolio_id
FROM picks WHERE picks.project_id = p.id AND p.portfolio_id IS NULL;

DELETE FROM public.project_portfolio_members ppm
WHERE (ppm.project_id, ppm.portfolio_id) NOT IN (
  SELECT p.id, p.portfolio_id FROM public.projects p WHERE p.portfolio_id IS NOT NULL
);

ALTER TABLE public.project_portfolio_members
  DROP CONSTRAINT IF EXISTS project_portfolio_members_project_id_key;
ALTER TABLE public.project_portfolio_members
  ADD CONSTRAINT project_portfolio_members_project_id_key UNIQUE (project_id);

CREATE OR REPLACE FUNCTION public.sync_project_portfolio_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.portfolio_id IS DISTINCT FROM OLD.portfolio_id) THEN
    IF TG_OP = 'UPDATE' AND OLD.portfolio_id IS NOT NULL THEN
      DELETE FROM public.project_portfolio_members WHERE project_id = NEW.id;
    END IF;
    IF NEW.portfolio_id IS NOT NULL THEN
      INSERT INTO public.project_portfolio_members (portfolio_id, project_id)
      VALUES (NEW.portfolio_id, NEW.id)
      ON CONFLICT (project_id) DO UPDATE SET portfolio_id = EXCLUDED.portfolio_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_project_portfolio_member ON public.projects;
CREATE TRIGGER trg_sync_project_portfolio_member
  AFTER INSERT OR UPDATE OF portfolio_id ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.sync_project_portfolio_member();

-- 4) Projekt-AP: Kategorie + Pflicht-AP
ALTER TABLE public.project_work_packages
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.work_package_categories(id),
  ADD COLUMN IF NOT EXISTS is_mandatory boolean NOT NULL DEFAULT false;

UPDATE public.project_work_packages
SET category_id = (SELECT id FROM public.work_package_categories WHERE name='Grundlagen & Charakterisierung')
WHERE category_id IS NULL;

ALTER TABLE public.project_work_packages ALTER COLUMN category_id SET NOT NULL;

INSERT INTO public.project_work_packages (project_id, title, description, status, is_mandatory, category_id, created_by)
SELECT p.id, 'Organisation Projektmanagement',
       'Automatisch erzeugtes Pflicht-Arbeitspaket für Projektmanagement, Berichtswesen und Koordination.',
       'planned'::milestone_status, true,
       (SELECT id FROM public.work_package_categories WHERE name='Projektmanagement'),
       COALESCE(p.created_by, '00000000-0000-0000-0000-000000000000'::uuid)
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_work_packages w WHERE w.project_id=p.id AND w.is_mandatory=true
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_project_mandatory_wp
  ON public.project_work_packages(project_id) WHERE is_mandatory=true;

CREATE OR REPLACE FUNCTION public.create_mandatory_wp_on_project()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _cat uuid;
BEGIN
  SELECT id INTO _cat FROM public.work_package_categories WHERE name='Projektmanagement' LIMIT 1;
  INSERT INTO public.project_work_packages (project_id, title, description, status, is_mandatory, category_id, created_by)
  VALUES (NEW.id, 'Organisation Projektmanagement',
          'Automatisch erzeugtes Pflicht-Arbeitspaket für Projektmanagement, Berichtswesen und Koordination.',
          'planned'::milestone_status, true, _cat,
          COALESCE(NEW.created_by, auth.uid()));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_create_mandatory_wp ON public.projects;
CREATE TRIGGER trg_create_mandatory_wp
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.create_mandatory_wp_on_project();

CREATE OR REPLACE FUNCTION public.prevent_mandatory_wp_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_mandatory THEN
    RAISE EXCEPTION 'Das Pflicht-Arbeitspaket "%" kann nicht gelöscht werden.', OLD.title USING ERRCODE='P0001';
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_prevent_mandatory_wp_delete ON public.project_work_packages;
CREATE TRIGGER trg_prevent_mandatory_wp_delete
  BEFORE DELETE ON public.project_work_packages
  FOR EACH ROW EXECUTE FUNCTION public.prevent_mandatory_wp_delete();

CREATE OR REPLACE FUNCTION public.protect_mandatory_wp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_mandatory AND NEW.is_mandatory=false THEN
    RAISE EXCEPTION 'Das Pflicht-Kennzeichen des Arbeitspakets kann nicht entfernt werden.' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_protect_mandatory_wp ON public.project_work_packages;
CREATE TRIGGER trg_protect_mandatory_wp
  BEFORE UPDATE ON public.project_work_packages
  FOR EACH ROW EXECUTE FUNCTION public.protect_mandatory_wp();

-- 5) Arbeitszeiten
ALTER TABLE public.project_time_entries
  ADD COLUMN IF NOT EXISTS work_package_id uuid REFERENCES public.project_work_packages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS portfolio_task_id uuid REFERENCES public.portfolio_tasks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pte_wp ON public.project_time_entries(work_package_id);
CREATE INDEX IF NOT EXISTS idx_pte_ptask ON public.project_time_entries(portfolio_task_id);

UPDATE public.project_time_entries pte
SET work_package_id = (
  SELECT id FROM public.project_work_packages
  WHERE project_id = pte.project_id AND is_mandatory=true LIMIT 1
)
WHERE work_package_id IS NULL;

CREATE OR REPLACE FUNCTION public.enforce_time_entry_work_package()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _proj uuid; _pf uuid;
BEGIN
  IF NEW.work_package_id IS NULL THEN
    SELECT id INTO NEW.work_package_id FROM public.project_work_packages
      WHERE project_id=NEW.project_id AND is_mandatory=true LIMIT 1;
    IF NEW.work_package_id IS NULL THEN
      RAISE EXCEPTION 'Für das Projekt existiert kein Pflicht-Arbeitspaket. Zeiterfassung nicht möglich.' USING ERRCODE='P0001';
    END IF;
  ELSE
    SELECT project_id INTO _proj FROM public.project_work_packages WHERE id=NEW.work_package_id;
    IF _proj IS DISTINCT FROM NEW.project_id THEN
      RAISE EXCEPTION 'Arbeitspaket gehört nicht zum ausgewählten Projekt.' USING ERRCODE='P0001';
    END IF;
  END IF;
  IF NEW.portfolio_task_id IS NOT NULL THEN
    SELECT pwp.portfolio_id INTO _pf
    FROM public.portfolio_tasks pt
    JOIN public.portfolio_work_packages pwp ON pwp.id=pt.portfolio_work_package_id
    WHERE pt.id=NEW.portfolio_task_id;
    IF _pf IS NULL OR _pf IS DISTINCT FROM (SELECT portfolio_id FROM public.projects WHERE id=NEW.project_id) THEN
      RAISE EXCEPTION 'Portfolio-Task passt nicht zum Portfolio des Projekts.' USING ERRCODE='P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_enforce_time_entry_wp ON public.project_time_entries;
CREATE TRIGGER trg_enforce_time_entry_wp
  BEFORE INSERT OR UPDATE ON public.project_time_entries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_time_entry_work_package();

-- 6) Analytics-RPCs
CREATE OR REPLACE FUNCTION public.get_portfolio_hours_by_work_package(_portfolio_id uuid, _start date DEFAULT NULL, _end date DEFAULT NULL)
RETURNS TABLE(portfolio_work_package_id uuid, code text, name text, category_id uuid, category_name text, minutes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT pwp.id, pwp.code, pwp.name, pwp.category_id, wpc.name,
         COALESCE(SUM(pte.duration_minutes),0)::bigint
  FROM public.portfolio_work_packages pwp
  LEFT JOIN public.work_package_categories wpc ON wpc.id=pwp.category_id
  LEFT JOIN public.projects p ON p.portfolio_id=pwp.portfolio_id
  LEFT JOIN public.project_work_packages projwp ON projwp.project_id=p.id AND projwp.category_id=pwp.category_id
  LEFT JOIN public.project_time_entries pte ON pte.work_package_id=projwp.id
    AND (_start IS NULL OR pte.entry_date>=_start) AND (_end IS NULL OR pte.entry_date<=_end)
  WHERE pwp.portfolio_id=_portfolio_id
  GROUP BY pwp.id, pwp.code, pwp.name, pwp.category_id, wpc.name, pwp.sort_order
  ORDER BY pwp.sort_order, pwp.name
$$;

CREATE OR REPLACE FUNCTION public.get_portfolio_hours_by_task(_portfolio_id uuid, _start date DEFAULT NULL, _end date DEFAULT NULL)
RETURNS TABLE(task_id uuid, task_name text, work_package_id uuid, work_package_name text, minutes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT pt.id, pt.name, pwp.id, pwp.name,
         COALESCE(SUM(pte.duration_minutes),0)::bigint
  FROM public.portfolio_tasks pt
  JOIN public.portfolio_work_packages pwp ON pwp.id=pt.portfolio_work_package_id
  LEFT JOIN public.project_time_entries pte ON pte.portfolio_task_id=pt.id
    AND (_start IS NULL OR pte.entry_date>=_start) AND (_end IS NULL OR pte.entry_date<=_end)
  WHERE pwp.portfolio_id=_portfolio_id
  GROUP BY pt.id, pt.name, pwp.id, pwp.name, pwp.sort_order, pt.sort_order
  ORDER BY pwp.sort_order, pt.sort_order, pt.name
$$;

CREATE OR REPLACE FUNCTION public.get_portfolio_hours_by_category(_portfolio_id uuid, _start date DEFAULT NULL, _end date DEFAULT NULL)
RETURNS TABLE(category_id uuid, category_name text, minutes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT wpc.id, wpc.name, COALESCE(SUM(pte.duration_minutes),0)::bigint
  FROM public.work_package_categories wpc
  LEFT JOIN public.project_work_packages projwp ON projwp.category_id=wpc.id
  LEFT JOIN public.projects p ON p.id=projwp.project_id AND p.portfolio_id=_portfolio_id
  LEFT JOIN public.project_time_entries pte ON pte.work_package_id=projwp.id
    AND (_start IS NULL OR pte.entry_date>=_start) AND (_end IS NULL OR pte.entry_date<=_end)
  WHERE p.id IS NOT NULL OR EXISTS (SELECT 1 FROM public.portfolio_work_packages WHERE portfolio_id=_portfolio_id AND category_id=wpc.id)
  GROUP BY wpc.id, wpc.name, wpc.sort_order
  ORDER BY wpc.sort_order, wpc.name
$$;

CREATE OR REPLACE FUNCTION public.get_portfolio_costs_by_work_package(_portfolio_id uuid, _start date DEFAULT NULL, _end date DEFAULT NULL)
RETURNS TABLE(portfolio_work_package_id uuid, name text, category_id uuid, category_name text, amount numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT pwp.id, pwp.name, pwp.category_id, wpc.name,
         COALESCE(SUM(pe.total_price),0)::numeric
  FROM public.portfolio_work_packages pwp
  LEFT JOIN public.work_package_categories wpc ON wpc.id=pwp.category_id
  LEFT JOIN public.projects p ON p.portfolio_id=pwp.portfolio_id
  LEFT JOIN public.project_work_packages projwp ON projwp.project_id=p.id AND projwp.category_id=pwp.category_id
  LEFT JOIN public.project_expenses pe ON pe.work_package_id=projwp.id
    AND (_start IS NULL OR pe.expense_date>=_start) AND (_end IS NULL OR pe.expense_date<=_end)
  WHERE pwp.portfolio_id=_portfolio_id
  GROUP BY pwp.id, pwp.name, pwp.category_id, wpc.name, pwp.sort_order
  ORDER BY pwp.sort_order, pwp.name
$$;

CREATE OR REPLACE FUNCTION public.get_portfolio_costs_by_category(_portfolio_id uuid, _start date DEFAULT NULL, _end date DEFAULT NULL)
RETURNS TABLE(category_id uuid, category_name text, amount numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT wpc.id, wpc.name, COALESCE(SUM(pe.total_price),0)::numeric
  FROM public.work_package_categories wpc
  LEFT JOIN public.project_work_packages projwp ON projwp.category_id=wpc.id
  LEFT JOIN public.projects p ON p.id=projwp.project_id AND p.portfolio_id=_portfolio_id
  LEFT JOIN public.project_expenses pe ON pe.work_package_id=projwp.id
    AND (_start IS NULL OR pe.expense_date>=_start) AND (_end IS NULL OR pe.expense_date<=_end)
  WHERE p.id IS NOT NULL OR EXISTS (SELECT 1 FROM public.portfolio_work_packages WHERE portfolio_id=_portfolio_id AND category_id=wpc.id)
  GROUP BY wpc.id, wpc.name, wpc.sort_order
  ORDER BY wpc.sort_order, wpc.name
$$;
