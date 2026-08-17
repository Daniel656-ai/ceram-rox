CREATE TABLE public.project_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  report_kind TEXT NOT NULL DEFAULT 'interim',
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.project_report_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.project_reports(id) ON DELETE CASCADE,
  measurement_result_id UUID NOT NULL REFERENCES public.measurement_results(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_id, measurement_result_id)
);

CREATE INDEX idx_project_reports_project ON public.project_reports(project_id);
CREATE INDEX idx_project_report_results_report ON public.project_report_results(report_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_reports TO authenticated;
GRANT ALL ON public.project_reports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_report_results TO authenticated;
GRANT ALL ON public.project_report_results TO service_role;

ALTER TABLE public.project_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_report_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_reports_select ON public.project_reports FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'master'::app_role) OR is_project_member(auth.uid(), project_id) OR has_permission(auth.uid(), 'projects.view'));

CREATE POLICY project_reports_insert ON public.project_reports FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR has_project_role(auth.uid(), project_id, 'owner'::project_role) OR has_project_role(auth.uid(), project_id, 'leader'::project_role) OR has_permission(auth.uid(), 'projects.edit'));

CREATE POLICY project_reports_update ON public.project_reports FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'master'::app_role) OR has_project_role(auth.uid(), project_id, 'owner'::project_role) OR has_project_role(auth.uid(), project_id, 'leader'::project_role) OR has_permission(auth.uid(), 'projects.edit'));

CREATE POLICY project_reports_delete ON public.project_reports FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'master'::app_role) OR has_project_role(auth.uid(), project_id, 'owner'::project_role) OR has_project_role(auth.uid(), project_id, 'leader'::project_role) OR has_permission(auth.uid(), 'projects.edit'));

CREATE POLICY project_report_results_select ON public.project_report_results FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.project_reports r WHERE r.id = report_id AND (has_role(auth.uid(), 'master'::app_role) OR is_project_member(auth.uid(), r.project_id) OR has_permission(auth.uid(), 'projects.view'))));

CREATE POLICY project_report_results_insert ON public.project_report_results FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.project_reports r WHERE r.id = report_id AND (has_role(auth.uid(), 'master'::app_role) OR has_project_role(auth.uid(), r.project_id, 'owner'::project_role) OR has_project_role(auth.uid(), r.project_id, 'leader'::project_role) OR has_permission(auth.uid(), 'projects.edit'))));

CREATE POLICY project_report_results_delete ON public.project_report_results FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.project_reports r WHERE r.id = report_id AND (has_role(auth.uid(), 'master'::app_role) OR has_project_role(auth.uid(), r.project_id, 'owner'::project_role) OR has_project_role(auth.uid(), r.project_id, 'leader'::project_role) OR has_permission(auth.uid(), 'projects.edit'))));

CREATE TRIGGER trg_project_reports_updated_at BEFORE UPDATE ON public.project_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();