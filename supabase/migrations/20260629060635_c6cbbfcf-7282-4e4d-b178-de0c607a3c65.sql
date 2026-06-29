
-- Status enum for closure reports
DO $$ BEGIN
  CREATE TYPE public.project_closure_status AS ENUM ('draft', 'in_approval', 'approved');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE public.project_closure_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status public.project_closure_status NOT NULL DEFAULT 'draft',

  -- Zielerreichung
  original_goals text,
  achieved_goals text,
  missed_goals text,
  deviation_reasons text,

  -- Terminbewertung
  planned_end_date date,
  actual_end_date date,
  schedule_deviation_days integer,
  schedule_root_cause text,

  -- Budgetbewertung
  budget_planned numeric,
  budget_actual numeric,
  budget_currency text DEFAULT 'EUR',
  budget_deviation_explanation text,

  -- Ergebnisbewertung
  delivered_results jsonb DEFAULT '[]'::jsonb,
  quality_assessment text,
  customer_satisfaction integer,
  open_items jsonb DEFAULT '[]'::jsonb,

  -- Lessons Learned
  went_well text,
  went_wrong text,
  risks_occurred text,
  success_factors text,
  recommendations text,

  -- Verknüpfungen / Summaries
  key_decisions_summary text,
  related_decision_ids uuid[] DEFAULT '{}',
  key_changes_summary text,
  related_change_request_ids uuid[] DEFAULT '{}',

  -- Abschlussfreigabe
  project_leader_id uuid,
  project_leader_signed_at timestamptz,
  sponsor_id uuid,
  sponsor_name text,
  sponsor_signed_at timestamptz,
  approval_date date,
  final_remarks text,

  created_by uuid NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (project_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_closure_reports TO authenticated;
GRANT ALL ON public.project_closure_reports TO service_role;

ALTER TABLE public.project_closure_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View closure when allowed to view project governance"
  ON public.project_closure_reports
  FOR SELECT TO authenticated
  USING (public.can_view_project_governance(auth.uid(), project_id));

CREATE POLICY "Insert closure when allowed to edit project governance"
  ON public.project_closure_reports
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project_governance(auth.uid(), project_id));

CREATE POLICY "Update closure when allowed to edit project governance"
  ON public.project_closure_reports
  FOR UPDATE TO authenticated
  USING (public.can_edit_project_governance(auth.uid(), project_id))
  WITH CHECK (public.can_edit_project_governance(auth.uid(), project_id));

CREATE POLICY "Delete closure when allowed to edit project governance"
  ON public.project_closure_reports
  FOR DELETE TO authenticated
  USING (public.can_edit_project_governance(auth.uid(), project_id));

CREATE TRIGGER trg_project_closure_reports_updated_at
  BEFORE UPDATE ON public.project_closure_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_project_closure_reports_project ON public.project_closure_reports(project_id);

-- Finalize: when closure approved, set project status to completed
CREATE OR REPLACE FUNCTION public.finalize_project_closure(_closure_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_project uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentifizierung erforderlich'; END IF;

  SELECT project_id INTO v_project FROM public.project_closure_reports WHERE id = _closure_id;
  IF v_project IS NULL THEN RAISE EXCEPTION 'Abschlussbericht nicht gefunden'; END IF;

  IF NOT public.can_edit_project_governance(v_actor, v_project) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Abschluss des Projekts';
  END IF;

  UPDATE public.project_closure_reports
     SET status = 'approved',
         approval_date = COALESCE(approval_date, CURRENT_DATE),
         updated_by = v_actor
   WHERE id = _closure_id;

  UPDATE public.projects
     SET project_status = 'completed',
         updated_at = now()
   WHERE id = v_project;
END $$;
