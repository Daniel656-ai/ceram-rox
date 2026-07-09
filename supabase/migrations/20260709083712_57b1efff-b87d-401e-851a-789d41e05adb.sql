CREATE OR REPLACE FUNCTION public.get_portfolio_milestone_timeline(_portfolio_id uuid)
RETURNS TABLE(
  source text,
  id uuid,
  portfolio_id uuid,
  project_id uuid,
  project_number text,
  project_name text,
  title text,
  description text,
  milestone_type text,
  milestone_date date,
  status text,
  completed_at timestamp with time zone,
  sort_date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    'portfolio'::text AS source,
    pm.id,
    pm.portfolio_id,
    NULL::uuid AS project_id,
    NULL::text AS project_number,
    NULL::text AS project_name,
    pm.title,
    pm.description,
    pm.milestone_type::text,
    pm.due_date AS milestone_date,
    pm.status::text,
    pm.completed_at,
    pm.due_date AS sort_date
  FROM public.project_portfolio_milestones pm
  WHERE pm.portfolio_id = _portfolio_id

  UNION ALL

  SELECT
    'project'::text AS source,
    m.id,
    ppm.portfolio_id,
    p.id AS project_id,
    p.project_number,
    p.project_name,
    m.title,
    m.description,
    'projekt'::text AS milestone_type,
    m.milestone_date,
    CASE
      WHEN m.status::text = 'completed' THEN 'erledigt'
      WHEN m.milestone_date IS NOT NULL AND m.milestone_date < CURRENT_DATE THEN 'ueberfaellig'
      ELSE 'offen'
    END AS status,
    NULL::timestamp with time zone AS completed_at,
    m.milestone_date AS sort_date
  FROM public.project_portfolio_members ppm
  JOIN public.projects p ON p.id = ppm.project_id
  JOIN public.project_milestones m ON m.project_id = ppm.project_id
  WHERE ppm.portfolio_id = _portfolio_id
$$;

GRANT EXECUTE ON FUNCTION public.get_portfolio_milestone_timeline(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_milestone_timeline(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_portfolio_dashboard(_portfolio_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH projects_scope AS (
    SELECT ppm.project_id
    FROM public.project_portfolio_members ppm
    WHERE ppm.portfolio_id = _portfolio_id
  ),
  milestones AS (
    SELECT *
    FROM public.get_portfolio_milestone_timeline(_portfolio_id)
  ),
  next_ms AS (
    SELECT jsonb_build_object(
      'source', source,
      'id', id,
      'project_id', project_id,
      'project_number', project_number,
      'project_name', project_name,
      'title', title,
      'due_date', milestone_date,
      'status', status
    ) AS value
    FROM milestones
    WHERE status <> 'erledigt'
    ORDER BY sort_date ASC NULLS LAST, title ASC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'projects_total', (SELECT count(*) FROM projects_scope),
    'milestones_total', (SELECT count(*) FROM milestones),
    'milestones_done', (SELECT count(*) FROM milestones WHERE status = 'erledigt'),
    'milestones_open', (SELECT count(*) FROM milestones WHERE status = 'offen'),
    'milestones_overdue', (SELECT count(*) FROM milestones WHERE status = 'ueberfaellig'),
    'milestones_upcoming', (
      SELECT count(*)
      FROM milestones
      WHERE status <> 'erledigt'
        AND milestone_date >= CURRENT_DATE
        AND milestone_date <= CURRENT_DATE + INTERVAL '30 days'
    ),
    'documents_total', (
      SELECT count(*)
      FROM public.project_portfolio_documents d
      WHERE d.portfolio_id = _portfolio_id
    ),
    'next_milestone', (SELECT value FROM next_ms)
  )
$$;

GRANT EXECUTE ON FUNCTION public.get_portfolio_dashboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_dashboard(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_portfolio_summary(_portfolio_id uuid, _start date DEFAULT NULL::date, _end date DEFAULT NULL::date)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH projects_scope AS (
    SELECT p.id, p.project_status, COALESCE(p.budget_total, 0) AS budget_total
    FROM public.project_portfolio_members ppm
    JOIN public.projects p ON p.id = ppm.project_id
    WHERE ppm.portfolio_id = _portfolio_id
  ),
  time_entries AS (
    SELECT te.*
    FROM public.project_time_entries te
    JOIN projects_scope ps ON ps.id = te.project_id
    WHERE (_start IS NULL OR te.entry_date >= _start)
      AND (_end IS NULL OR te.entry_date <= _end)
  ),
  personnel AS (
    SELECT COALESCE(sum(COALESCE(om.actual_duration_hours, om.planned_hours, 0) * COALESCE(ms.hourly_rate, 0)), 0) AS cost
    FROM public.measurement_orders mo
    JOIN projects_scope ps ON ps.id = mo.project_id
    JOIN public.order_measurements om ON om.order_id = mo.id
    JOIN public.measurement_services ms ON ms.id = om.service_id
    WHERE (_start IS NULL OR COALESCE(om.planned_end_date, om.planned_start_date, om.due_date, mo.due_date, mo.created_at::date) >= _start)
      AND (_end IS NULL OR COALESCE(om.planned_end_date, om.planned_start_date, om.due_date, mo.due_date, mo.created_at::date) <= _end)
  ),
  consumables AS (
    SELECT COALESCE(sum(COALESCE(pc.total_cost, pc.quantity * pc.unit_price)), 0) AS cost
    FROM public.project_consumables pc
    JOIN projects_scope ps ON ps.id = pc.project_id
    WHERE (_start IS NULL OR pc.created_at::date >= _start)
      AND (_end IS NULL OR pc.created_at::date <= _end)
  ),
  knetung AS (
    SELECT COALESCE(sum(COALESCE(pkm.total_cost, pkm.quantity_kg * pkm.price_per_kg)), 0) AS cost
    FROM public.project_knetung_materials pkm
    JOIN projects_scope ps ON ps.id = pkm.project_id
    WHERE (_start IS NULL OR pkm.created_at::date >= _start)
      AND (_end IS NULL OR pkm.created_at::date <= _end)
  ),
  expenses AS (
    SELECT COALESCE(sum(COALESCE(pe.total_price, pe.quantity * pe.unit_price, 0)), 0) AS cost
    FROM public.project_expenses pe
    JOIN projects_scope ps ON ps.id = pe.project_id
    WHERE (_start IS NULL OR pe.expense_date >= _start)
      AND (_end IS NULL OR pe.expense_date <= _end)
  ),
  people AS (
    SELECT count(DISTINCT person_id) AS count FROM time_entries
  ),
  milestones AS (
    SELECT * FROM public.get_portfolio_milestone_timeline(_portfolio_id)
  ),
  totals AS (
    SELECT
      (SELECT count(*) FROM projects_scope) AS project_count,
      (SELECT count(*) FROM projects_scope WHERE project_status::text = 'active') AS active_count,
      (SELECT count(*) FROM projects_scope WHERE project_status::text = 'completed') AS closed_count,
      (SELECT count FROM people) AS people_count,
      COALESCE((SELECT sum(duration_minutes) / 60.0 FROM time_entries), 0) AS hours_total,
      (SELECT cost FROM personnel) AS personnel_cost,
      (SELECT cost FROM consumables) AS consumables_cost,
      (SELECT cost FROM knetung) AS knetung_cost,
      (SELECT cost FROM expenses) AS expenses_cost,
      COALESCE((SELECT sum(budget_total) FROM projects_scope), 0) AS budget_total,
      (SELECT count(*) FROM milestones WHERE status = 'offen') AS milestones_open,
      (SELECT count(*) FROM milestones WHERE status = 'erledigt') AS milestones_done,
      (SELECT count(*) FROM milestones WHERE status = 'ueberfaellig') AS milestones_overdue
  )
  SELECT jsonb_build_object(
    'project_count', project_count,
    'active_count', active_count,
    'closed_count', closed_count,
    'people_count', people_count,
    'hours_total', hours_total,
    'personnel_cost', personnel_cost,
    'consumables_cost', consumables_cost,
    'knetung_cost', knetung_cost,
    'expenses_cost', expenses_cost,
    'material_cost', consumables_cost + knetung_cost,
    'cost_total', personnel_cost + consumables_cost + knetung_cost + expenses_cost,
    'budget_total', budget_total,
    'budget_remaining', budget_total - (personnel_cost + consumables_cost + knetung_cost + expenses_cost),
    'milestones_open', milestones_open,
    'milestones_done', milestones_done,
    'milestones_overdue', milestones_overdue
  )
  FROM totals
$$;

GRANT EXECUTE ON FUNCTION public.get_portfolio_summary(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_summary(uuid, date, date) TO service_role;