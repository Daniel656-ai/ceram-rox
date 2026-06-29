
-- Budget fields on projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS budget_total numeric,
  ADD COLUMN IF NOT EXISTS budget_warning_threshold int DEFAULT 80,
  ADD COLUMN IF NOT EXISTS budget_currency text DEFAULT 'EUR';

-- Enums
DO $$ BEGIN
  CREATE TYPE public.change_request_status AS ENUM ('pending','approved','rejected','withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.decision_status AS ENUM ('active','superseded','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.stakeholder_channel AS ENUM ('email','phone','meeting','portal','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.stakeholder_frequency AS ENUM ('daily','weekly','biweekly','monthly','quarterly','adhoc');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helper: can_edit_project_governance
CREATE OR REPLACE FUNCTION public.can_edit_project_governance(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'master'::app_role)
    OR public.has_project_role(_user_id, _project_id, 'owner'::project_role)
    OR public.has_project_role(_user_id, _project_id, 'leader'::project_role)
    OR public.has_permission(_user_id, 'projects.edit');
$$;

CREATE OR REPLACE FUNCTION public.can_view_project_governance(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'master'::app_role)
    OR public.is_project_member(_user_id, _project_id)
    OR public.has_permission(_user_id, 'projects.view');
$$;

-- 1) Change Requests
CREATE TABLE IF NOT EXISTS public.project_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  requested_by uuid NOT NULL,
  approver_id uuid,
  approval_status public.change_request_status NOT NULL DEFAULT 'pending',
  approval_date timestamptz,
  impact_budget numeric,
  impact_schedule_days int,
  impact_description text,
  related_milestone_id uuid REFERENCES public.project_milestones(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_change_requests TO authenticated;
GRANT ALL ON public.project_change_requests TO service_role;
ALTER TABLE public.project_change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view change requests" ON public.project_change_requests FOR SELECT TO authenticated
  USING (public.can_view_project_governance(auth.uid(), project_id));
CREATE POLICY "manage change requests" ON public.project_change_requests FOR ALL TO authenticated
  USING (public.can_edit_project_governance(auth.uid(), project_id))
  WITH CHECK (public.can_edit_project_governance(auth.uid(), project_id));
CREATE TRIGGER trg_pcr_updated BEFORE UPDATE ON public.project_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Decisions
CREATE TABLE IF NOT EXISTS public.project_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  decision_date date NOT NULL DEFAULT CURRENT_DATE,
  rationale text,
  decided_by uuid,
  affected_areas text[] DEFAULT ARRAY[]::text[],
  status public.decision_status NOT NULL DEFAULT 'active',
  superseded_by uuid REFERENCES public.project_decisions(id) ON DELETE SET NULL,
  related_milestone_id uuid REFERENCES public.project_milestones(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_decisions TO authenticated;
GRANT ALL ON public.project_decisions TO service_role;
ALTER TABLE public.project_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view decisions" ON public.project_decisions FOR SELECT TO authenticated
  USING (public.can_view_project_governance(auth.uid(), project_id));
CREATE POLICY "manage decisions" ON public.project_decisions FOR ALL TO authenticated
  USING (public.can_edit_project_governance(auth.uid(), project_id))
  WITH CHECK (public.can_edit_project_governance(auth.uid(), project_id));
CREATE TRIGGER trg_pd_updated BEFORE UPDATE ON public.project_decisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Stakeholders
CREATE TABLE IF NOT EXISTS public.project_stakeholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  organization text,
  role text,
  contact_email text,
  contact_phone text,
  channel public.stakeholder_channel DEFAULT 'email',
  frequency public.stakeholder_frequency DEFAULT 'monthly',
  responsible_user_id uuid,
  last_contact_at timestamptz,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_stakeholders TO authenticated;
GRANT ALL ON public.project_stakeholders TO service_role;
ALTER TABLE public.project_stakeholders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view stakeholders" ON public.project_stakeholders FOR SELECT TO authenticated
  USING (public.can_view_project_governance(auth.uid(), project_id));
CREATE POLICY "manage stakeholders" ON public.project_stakeholders FOR ALL TO authenticated
  USING (public.can_edit_project_governance(auth.uid(), project_id))
  WITH CHECK (public.can_edit_project_governance(auth.uid(), project_id));
CREATE TRIGGER trg_ps_updated BEFORE UPDATE ON public.project_stakeholders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Lessons Learned
CREATE TABLE IF NOT EXISTS public.project_lessons_learned (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  went_well text,
  went_wrong text,
  recommendations text,
  overall_rating int CHECK (overall_rating IS NULL OR (overall_rating BETWEEN 1 AND 5)),
  follow_up_actions text,
  related_weekly_review_ids uuid[] DEFAULT ARRAY[]::uuid[],
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_lessons_learned TO authenticated;
GRANT ALL ON public.project_lessons_learned TO service_role;
ALTER TABLE public.project_lessons_learned ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view lessons" ON public.project_lessons_learned FOR SELECT TO authenticated
  USING (public.can_view_project_governance(auth.uid(), project_id));
CREATE POLICY "manage lessons" ON public.project_lessons_learned FOR ALL TO authenticated
  USING (public.can_edit_project_governance(auth.uid(), project_id))
  WITH CHECK (public.can_edit_project_governance(auth.uid(), project_id));
CREATE TRIGGER trg_pll_updated BEFORE UPDATE ON public.project_lessons_learned
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pcr_project ON public.project_change_requests(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pd_project ON public.project_decisions(project_id, decision_date DESC);
CREATE INDEX IF NOT EXISTS idx_ps_project ON public.project_stakeholders(project_id);
CREATE INDEX IF NOT EXISTS idx_pll_project ON public.project_lessons_learned(project_id, created_at DESC);
