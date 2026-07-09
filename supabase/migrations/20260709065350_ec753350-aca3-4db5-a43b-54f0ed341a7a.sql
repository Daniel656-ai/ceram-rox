
-- =========================================================
-- Projektportfolio – Phase 1: Datenmodell + Rechte
-- =========================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.portfolio_status AS ENUM ('planung','aktiv','pausiert','abgeschlossen','abgebrochen');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.portfolio_milestone_type AS ENUM ('antrag','genehmigung','zwischenbericht','review','abschluss','sonstiges');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.portfolio_milestone_status AS ENUM ('offen','erledigt','ueberfaellig');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.portfolio_document_category AS ENUM ('foerderantrag','foerdervertrag','zwischenbericht','endbericht','praesentation','publikation','patent','nachweis','sonstiges');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- 1) project_portfolios
-- =========================================================
CREATE TABLE IF NOT EXISTS public.project_portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_code text,
  description text,
  category text,
  funding_program text,
  funding_body text,
  start_date date,
  end_date date,
  status public.portfolio_status NOT NULL DEFAULT 'planung',
  responsible_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  planned_budget numeric(14,2),
  approved_budget numeric(14,2),
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_portfolios TO authenticated;
GRANT ALL ON public.project_portfolios TO service_role;
ALTER TABLE public.project_portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portfolios_select" ON public.project_portfolios
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'portfolios.view'));

CREATE POLICY "portfolios_insert" ON public.project_portfolios
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'portfolios.create'));

CREATE POLICY "portfolios_update" ON public.project_portfolios
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'portfolios.edit'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'portfolios.edit'));

CREATE POLICY "portfolios_delete" ON public.project_portfolios
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'portfolios.delete'));

CREATE TRIGGER trg_portfolios_updated_at BEFORE UPDATE ON public.project_portfolios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 2) project_portfolio_members (M:N)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.project_portfolio_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.project_portfolios(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  contribution_goal text,
  contribution_summary text,
  current_status text,
  key_results text,
  added_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_ppm_portfolio ON public.project_portfolio_members(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_ppm_project ON public.project_portfolio_members(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_portfolio_members TO authenticated;
GRANT ALL ON public.project_portfolio_members TO service_role;
ALTER TABLE public.project_portfolio_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ppm_select" ON public.project_portfolio_members
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'portfolios.view'));

CREATE POLICY "ppm_insert" ON public.project_portfolio_members
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'portfolios.assign_projects'));

CREATE POLICY "ppm_update" ON public.project_portfolio_members
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'portfolios.edit'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'portfolios.edit'));

CREATE POLICY "ppm_delete" ON public.project_portfolio_members
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'portfolios.remove_projects'));

CREATE TRIGGER trg_ppm_updated_at BEFORE UPDATE ON public.project_portfolio_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 3) project_portfolio_periods (Förderperioden)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.project_portfolio_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.project_portfolios(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ppp_portfolio ON public.project_portfolio_periods(portfolio_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_portfolio_periods TO authenticated;
GRANT ALL ON public.project_portfolio_periods TO service_role;
ALTER TABLE public.project_portfolio_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ppp_select" ON public.project_portfolio_periods
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'portfolios.view'));

CREATE POLICY "ppp_write" ON public.project_portfolio_periods
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'portfolios.edit'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'portfolios.edit'));

CREATE TRIGGER trg_ppp_updated_at BEFORE UPDATE ON public.project_portfolio_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 4) project_portfolio_milestones
-- =========================================================
CREATE TABLE IF NOT EXISTS public.project_portfolio_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.project_portfolios(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  milestone_type public.portfolio_milestone_type NOT NULL DEFAULT 'sonstiges',
  due_date date,
  completed_at timestamptz,
  status public.portfolio_milestone_status NOT NULL DEFAULT 'offen',
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ppmil_portfolio ON public.project_portfolio_milestones(portfolio_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_portfolio_milestones TO authenticated;
GRANT ALL ON public.project_portfolio_milestones TO service_role;
ALTER TABLE public.project_portfolio_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ppmil_select" ON public.project_portfolio_milestones
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'portfolios.view'));

CREATE POLICY "ppmil_write" ON public.project_portfolio_milestones
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'portfolios.edit'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'portfolios.edit'));

CREATE TRIGGER trg_ppmil_updated_at BEFORE UPDATE ON public.project_portfolio_milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 5) project_portfolio_documents
-- =========================================================
CREATE TABLE IF NOT EXISTS public.project_portfolio_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.project_portfolios(id) ON DELETE CASCADE,
  category public.portfolio_document_category NOT NULL DEFAULT 'sonstiges',
  title text NOT NULL,
  description text,
  file_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  version int NOT NULL DEFAULT 1,
  supersedes_id uuid REFERENCES public.project_portfolio_documents(id) ON DELETE SET NULL,
  uploaded_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ppd_portfolio ON public.project_portfolio_documents(portfolio_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_portfolio_documents TO authenticated;
GRANT ALL ON public.project_portfolio_documents TO service_role;
ALTER TABLE public.project_portfolio_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ppd_select" ON public.project_portfolio_documents
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'portfolios.view'));

CREATE POLICY "ppd_write" ON public.project_portfolio_documents
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'portfolios.documents.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'portfolios.documents.manage'));

CREATE TRIGGER trg_ppd_updated_at BEFORE UPDATE ON public.project_portfolio_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 6) Berechtigungen + neue PMO-Rolle seeden
-- =========================================================
DO $$
DECLARE
  admin_role_id uuid;
  pmo_role_id   uuid;
  perm text;
  perms text[] := ARRAY[
    'nav.portfolios',
    'portfolios.view',
    'portfolios.create',
    'portfolios.edit',
    'portfolios.delete',
    'portfolios.assign_projects',
    'portfolios.remove_projects',
    'portfolios.export',
    'portfolios.documents.manage',
    'portfolios.dashboard.view'
  ];
BEGIN
  -- Admin-Rolle finden (Name enthält "admin", case-insensitive)
  SELECT id INTO admin_role_id FROM public.custom_roles
   WHERE lower(name) LIKE '%admin%' ORDER BY created_at ASC LIMIT 1;

  -- PMO anlegen falls nicht vorhanden
  SELECT id INTO pmo_role_id FROM public.custom_roles WHERE lower(name)='pmo' LIMIT 1;
  IF pmo_role_id IS NULL THEN
    INSERT INTO public.custom_roles (name, description, base_role)
    VALUES ('PMO','Project Management Office – Portfolio-Vollzugriff','master')
    RETURNING id INTO pmo_role_id;
  END IF;

  FOREACH perm IN ARRAY perms LOOP
    IF admin_role_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_key)
      VALUES (admin_role_id, perm)
      ON CONFLICT DO NOTHING;
    END IF;
    INSERT INTO public.role_permissions (role_id, permission_key)
    VALUES (pmo_role_id, perm)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
