
ALTER TABLE public.project_portfolios
  ADD COLUMN IF NOT EXISTS traffic_light text NOT NULL DEFAULT 'green'
    CHECK (traffic_light IN ('green','yellow','red')),
  ADD COLUMN IF NOT EXISTS health_note text,
  ADD COLUMN IF NOT EXISTS health_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS health_updated_by uuid;

CREATE OR REPLACE FUNCTION public.get_portfolio_dashboard(_portfolio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF NOT (has_role(auth.uid(),'master'::app_role)
          OR has_permission(auth.uid(),'portfolios.view')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'projects_total', (SELECT count(*) FROM project_portfolio_members WHERE portfolio_id = _portfolio_id),
    'milestones_total', (SELECT count(*) FROM project_portfolio_milestones WHERE portfolio_id = _portfolio_id),
    'milestones_done', (SELECT count(*) FROM project_portfolio_milestones WHERE portfolio_id = _portfolio_id AND status = 'erledigt'),
    'milestones_overdue', (SELECT count(*) FROM project_portfolio_milestones
                            WHERE portfolio_id = _portfolio_id
                              AND status <> 'erledigt'
                              AND due_date IS NOT NULL AND due_date < current_date),
    'milestones_upcoming', (SELECT count(*) FROM project_portfolio_milestones
                              WHERE portfolio_id = _portfolio_id
                                AND status <> 'erledigt'
                                AND due_date IS NOT NULL
                                AND due_date >= current_date
                                AND due_date <= current_date + INTERVAL '30 days'),
    'documents_total', (SELECT count(*) FROM project_portfolio_documents WHERE portfolio_id = _portfolio_id),
    'next_milestone', (SELECT jsonb_build_object('id',id,'title',title,'due_date',due_date,'status',status)
                        FROM project_portfolio_milestones
                        WHERE portfolio_id = _portfolio_id AND status <> 'erledigt'
                        ORDER BY due_date NULLS LAST LIMIT 1)
  ) INTO _result;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_portfolio_dashboard(uuid) TO authenticated;
