
-- Helper: check portfolio view access
CREATE OR REPLACE FUNCTION public.can_view_portfolio(_user_id uuid, _portfolio_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'master'::app_role)
    OR public.has_permission(_user_id, 'portfolios.view')
    OR public.has_permission(_user_id, 'portfolios.dashboard.view')
    OR EXISTS (
      SELECT 1 FROM public.project_portfolios p
      WHERE p.id = _portfolio_id AND p.responsible_user_id = _user_id
    );
$$;

-- Summary KPIs
CREATE OR REPLACE FUNCTION public.get_portfolio_summary(
  _portfolio_id uuid,
  _start date DEFAULT NULL,
  _end date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project_ids uuid[];
  v_hours numeric := 0;
  v_personnel_cost numeric := 0;
  v_consumables numeric := 0;
  v_knetung numeric := 0;
  v_expenses numeric := 0;
  v_budget numeric := 0;
  v_project_count int := 0;
  v_active int := 0;
  v_closed int := 0;
  v_people int := 0;
  v_milestones_open int := 0;
  v_milestones_done int := 0;
  v_milestones_overdue int := 0;
BEGIN
  IF v_uid IS NULL OR NOT public.can_view_portfolio(v_uid, _portfolio_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;

  SELECT array_agg(project_id) INTO v_project_ids
  FROM public.project_portfolio_members WHERE portfolio_id = _portfolio_id;

  IF v_project_ids IS NULL THEN v_project_ids := ARRAY[]::uuid[]; END IF;

  SELECT count(*),
         count(*) FILTER (WHERE project_status IN ('aktiv','geplant')),
         count(*) FILTER (WHERE project_status IN ('abgeschlossen','abgebrochen')),
         COALESCE(SUM(budget_total),0)
    INTO v_project_count, v_active, v_closed, v_budget
    FROM public.projects WHERE id = ANY(v_project_ids);

  SELECT COALESCE(SUM(duration_minutes)/60.0, 0), COUNT(DISTINCT person_id)
    INTO v_hours, v_people
    FROM public.project_time_entries
   WHERE project_id = ANY(v_project_ids)
     AND (_start IS NULL OR entry_date >= _start)
     AND (_end   IS NULL OR entry_date <= _end);

  SELECT COALESCE(SUM(om.actual_duration_hours * COALESCE(s.hourly_rate,0)),0)
    INTO v_personnel_cost
    FROM public.order_measurements om
    JOIN public.measurement_orders mo ON mo.id = om.order_id
    JOIN public.measurement_services s ON s.id = om.service_id
   WHERE mo.project_id = ANY(v_project_ids)
     AND (_start IS NULL OR om.updated_at::date >= _start)
     AND (_end   IS NULL OR om.updated_at::date <= _end);

  SELECT COALESCE(SUM(total_cost),0) INTO v_consumables
    FROM public.project_consumables
   WHERE project_id = ANY(v_project_ids)
     AND (_start IS NULL OR created_at::date >= _start)
     AND (_end   IS NULL OR created_at::date <= _end);

  SELECT COALESCE(SUM(total_cost),0) INTO v_knetung
    FROM public.project_knetung_materials
   WHERE project_id = ANY(v_project_ids)
     AND (_start IS NULL OR created_at::date >= _start)
     AND (_end   IS NULL OR created_at::date <= _end);

  SELECT COALESCE(SUM(total_price),0) INTO v_expenses
    FROM public.project_expenses
   WHERE project_id = ANY(v_project_ids)
     AND (_start IS NULL OR COALESCE(expense_date, created_at::date) >= _start)
     AND (_end   IS NULL OR COALESCE(expense_date, created_at::date) <= _end);

  SELECT
    count(*) FILTER (WHERE status = 'offen'),
    count(*) FILTER (WHERE status = 'erledigt'),
    count(*) FILTER (WHERE status = 'offen' AND due_date IS NOT NULL AND due_date < CURRENT_DATE)
    INTO v_milestones_open, v_milestones_done, v_milestones_overdue
    FROM public.project_portfolio_milestones WHERE portfolio_id = _portfolio_id;

  RETURN jsonb_build_object(
    'project_count', v_project_count,
    'active_count', v_active,
    'closed_count', v_closed,
    'people_count', v_people,
    'hours_total', ROUND(v_hours::numeric, 2),
    'personnel_cost', ROUND(v_personnel_cost::numeric, 2),
    'consumables_cost', ROUND(v_consumables::numeric, 2),
    'knetung_cost', ROUND(v_knetung::numeric, 2),
    'expenses_cost', ROUND(v_expenses::numeric, 2),
    'material_cost', ROUND((v_consumables + v_knetung)::numeric, 2),
    'cost_total', ROUND((v_personnel_cost + v_consumables + v_knetung + v_expenses)::numeric, 2),
    'budget_total', ROUND(v_budget::numeric, 2),
    'budget_remaining', ROUND((v_budget - (v_personnel_cost + v_consumables + v_knetung + v_expenses))::numeric, 2),
    'milestones_open', v_milestones_open,
    'milestones_done', v_milestones_done,
    'milestones_overdue', v_milestones_overdue
  );
END $$;

-- Hours per project
CREATE OR REPLACE FUNCTION public.get_portfolio_hours_by_project(
  _portfolio_id uuid, _start date DEFAULT NULL, _end date DEFAULT NULL
) RETURNS TABLE(project_id uuid, project_number text, project_name text, hours numeric, entries_count int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.can_view_portfolio(v_uid, _portfolio_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  RETURN QUERY
    SELECT p.id, p.project_number, p.project_name,
           ROUND(COALESCE(SUM(t.duration_minutes),0)/60.0, 2) AS hours,
           COUNT(t.id)::int
    FROM public.project_portfolio_members m
    JOIN public.projects p ON p.id = m.project_id
    LEFT JOIN public.project_time_entries t ON t.project_id = p.id
      AND (_start IS NULL OR t.entry_date >= _start)
      AND (_end   IS NULL OR t.entry_date <= _end)
    WHERE m.portfolio_id = _portfolio_id
    GROUP BY p.id, p.project_number, p.project_name
    ORDER BY p.project_number;
END $$;

-- Hours per person
CREATE OR REPLACE FUNCTION public.get_portfolio_hours_by_person(
  _portfolio_id uuid, _start date DEFAULT NULL, _end date DEFAULT NULL
) RETURNS TABLE(person_id uuid, first_name text, last_name text, short_code text, hours numeric, entries_count int, project_count int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.can_view_portfolio(v_uid, _portfolio_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  RETURN QUERY
    SELECT t.person_id, pr.first_name, pr.last_name, pr.short_code,
           ROUND(SUM(t.duration_minutes)/60.0, 2) AS hours,
           COUNT(*)::int, COUNT(DISTINCT t.project_id)::int
    FROM public.project_time_entries t
    JOIN public.project_portfolio_members m ON m.project_id = t.project_id
    LEFT JOIN public.profiles pr ON pr.user_id = t.person_id
    WHERE m.portfolio_id = _portfolio_id
      AND (_start IS NULL OR t.entry_date >= _start)
      AND (_end   IS NULL OR t.entry_date <= _end)
    GROUP BY t.person_id, pr.first_name, pr.last_name, pr.short_code
    ORDER BY hours DESC;
END $$;

-- Hours per month
CREATE OR REPLACE FUNCTION public.get_portfolio_hours_by_month(
  _portfolio_id uuid, _start date DEFAULT NULL, _end date DEFAULT NULL
) RETURNS TABLE(month text, hours numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.can_view_portfolio(v_uid, _portfolio_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  RETURN QUERY
    SELECT to_char(date_trunc('month', t.entry_date), 'YYYY-MM') AS month,
           ROUND(SUM(t.duration_minutes)/60.0, 2)
    FROM public.project_time_entries t
    JOIN public.project_portfolio_members m ON m.project_id = t.project_id
    WHERE m.portfolio_id = _portfolio_id
      AND (_start IS NULL OR t.entry_date >= _start)
      AND (_end   IS NULL OR t.entry_date <= _end)
    GROUP BY 1 ORDER BY 1;
END $$;

-- Costs per project
CREATE OR REPLACE FUNCTION public.get_portfolio_costs_by_project(
  _portfolio_id uuid, _start date DEFAULT NULL, _end date DEFAULT NULL
) RETURNS TABLE(
  project_id uuid, project_number text, project_name text,
  personnel_cost numeric, consumables_cost numeric, knetung_cost numeric,
  expenses_cost numeric, cost_total numeric, budget_total numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.can_view_portfolio(v_uid, _portfolio_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  RETURN QUERY
  WITH proj AS (
    SELECT p.id, p.project_number, p.project_name, p.budget_total
    FROM public.project_portfolio_members m
    JOIN public.projects p ON p.id = m.project_id
    WHERE m.portfolio_id = _portfolio_id
  ),
  personnel AS (
    SELECT mo.project_id, COALESCE(SUM(om.actual_duration_hours * COALESCE(s.hourly_rate,0)),0) c
      FROM public.order_measurements om
      JOIN public.measurement_orders mo ON mo.id = om.order_id
      JOIN public.measurement_services s ON s.id = om.service_id
     WHERE mo.project_id IN (SELECT id FROM proj)
       AND (_start IS NULL OR om.updated_at::date >= _start)
       AND (_end   IS NULL OR om.updated_at::date <= _end)
     GROUP BY mo.project_id
  ),
  cons AS (
    SELECT project_id, COALESCE(SUM(total_cost),0) c FROM public.project_consumables
     WHERE project_id IN (SELECT id FROM proj)
       AND (_start IS NULL OR created_at::date >= _start)
       AND (_end   IS NULL OR created_at::date <= _end)
     GROUP BY project_id
  ),
  kn AS (
    SELECT project_id, COALESCE(SUM(total_cost),0) c FROM public.project_knetung_materials
     WHERE project_id IN (SELECT id FROM proj)
       AND (_start IS NULL OR created_at::date >= _start)
       AND (_end   IS NULL OR created_at::date <= _end)
     GROUP BY project_id
  ),
  exp AS (
    SELECT project_id, COALESCE(SUM(total_price),0) c FROM public.project_expenses
     WHERE project_id IN (SELECT id FROM proj)
       AND (_start IS NULL OR COALESCE(expense_date, created_at::date) >= _start)
       AND (_end   IS NULL OR COALESCE(expense_date, created_at::date) <= _end)
     GROUP BY project_id
  )
  SELECT p.id, p.project_number, p.project_name,
         ROUND(COALESCE(pe.c,0)::numeric,2),
         ROUND(COALESCE(co.c,0)::numeric,2),
         ROUND(COALESCE(kn.c,0)::numeric,2),
         ROUND(COALESCE(ex.c,0)::numeric,2),
         ROUND((COALESCE(pe.c,0)+COALESCE(co.c,0)+COALESCE(kn.c,0)+COALESCE(ex.c,0))::numeric,2),
         ROUND(COALESCE(p.budget_total,0)::numeric,2)
  FROM proj p
  LEFT JOIN personnel pe ON pe.project_id = p.id
  LEFT JOIN cons co ON co.project_id = p.id
  LEFT JOIN kn  ON kn.project_id = p.id
  LEFT JOIN exp ex ON ex.project_id = p.id
  ORDER BY p.project_number;
END $$;

-- Costs per month
CREATE OR REPLACE FUNCTION public.get_portfolio_costs_by_month(
  _portfolio_id uuid, _start date DEFAULT NULL, _end date DEFAULT NULL
) RETURNS TABLE(month text, personnel_cost numeric, material_cost numeric, expenses_cost numeric, cost_total numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.can_view_portfolio(v_uid, _portfolio_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  RETURN QUERY
  WITH proj AS (SELECT project_id FROM public.project_portfolio_members WHERE portfolio_id = _portfolio_id),
  personnel AS (
    SELECT to_char(date_trunc('month', om.updated_at), 'YYYY-MM') m,
           SUM(om.actual_duration_hours * COALESCE(s.hourly_rate,0)) c
    FROM public.order_measurements om
    JOIN public.measurement_orders mo ON mo.id = om.order_id
    JOIN public.measurement_services s ON s.id = om.service_id
    WHERE mo.project_id IN (SELECT project_id FROM proj)
      AND (_start IS NULL OR om.updated_at::date >= _start)
      AND (_end   IS NULL OR om.updated_at::date <= _end)
    GROUP BY 1
  ),
  mat AS (
    SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') m, SUM(total_cost) c
    FROM public.project_consumables WHERE project_id IN (SELECT project_id FROM proj)
      AND (_start IS NULL OR created_at::date >= _start) AND (_end IS NULL OR created_at::date <= _end)
    GROUP BY 1
    UNION ALL
    SELECT to_char(date_trunc('month', created_at), 'YYYY-MM'), SUM(total_cost)
    FROM public.project_knetung_materials WHERE project_id IN (SELECT project_id FROM proj)
      AND (_start IS NULL OR created_at::date >= _start) AND (_end IS NULL OR created_at::date <= _end)
    GROUP BY 1
  ),
  mat_agg AS (SELECT m, SUM(c) c FROM mat GROUP BY m),
  exp AS (
    SELECT to_char(date_trunc('month', COALESCE(expense_date, created_at::date)), 'YYYY-MM') m,
           SUM(total_price) c
    FROM public.project_expenses WHERE project_id IN (SELECT project_id FROM proj)
      AND (_start IS NULL OR COALESCE(expense_date, created_at::date) >= _start)
      AND (_end IS NULL OR COALESCE(expense_date, created_at::date) <= _end)
    GROUP BY 1
  ),
  months AS (
    SELECT m FROM personnel UNION SELECT m FROM mat_agg UNION SELECT m FROM exp
  )
  SELECT mo.m,
         ROUND(COALESCE(pe.c,0)::numeric,2),
         ROUND(COALESCE(ma.c,0)::numeric,2),
         ROUND(COALESCE(ex.c,0)::numeric,2),
         ROUND((COALESCE(pe.c,0)+COALESCE(ma.c,0)+COALESCE(ex.c,0))::numeric,2)
  FROM months mo
  LEFT JOIN personnel pe ON pe.m = mo.m
  LEFT JOIN mat_agg  ma ON ma.m = mo.m
  LEFT JOIN exp      ex ON ex.m = mo.m
  ORDER BY mo.m;
END $$;

-- Person journal (chronological time entries)
CREATE OR REPLACE FUNCTION public.get_portfolio_person_journal(
  _portfolio_id uuid, _start date DEFAULT NULL, _end date DEFAULT NULL
) RETURNS TABLE(
  entry_id uuid, entry_date date, project_id uuid, project_number text, project_name text,
  person_id uuid, first_name text, last_name text, short_code text,
  duration_minutes int, hours numeric, note text, entry_type text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.can_view_portfolio(v_uid, _portfolio_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  RETURN QUERY
  SELECT t.id, t.entry_date, p.id, p.project_number, p.project_name,
         t.person_id, pr.first_name, pr.last_name, pr.short_code,
         t.duration_minutes, ROUND(t.duration_minutes/60.0, 2), t.note, t.entry_type
  FROM public.project_time_entries t
  JOIN public.project_portfolio_members m ON m.project_id = t.project_id
  JOIN public.projects p ON p.id = t.project_id
  LEFT JOIN public.profiles pr ON pr.user_id = t.person_id
  WHERE m.portfolio_id = _portfolio_id
    AND (_start IS NULL OR t.entry_date >= _start)
    AND (_end   IS NULL OR t.entry_date <= _end)
  ORDER BY t.entry_date DESC, t.created_at DESC;
END $$;

-- Cost journal (chronological cost items)
CREATE OR REPLACE FUNCTION public.get_portfolio_cost_journal(
  _portfolio_id uuid, _start date DEFAULT NULL, _end date DEFAULT NULL
) RETURNS TABLE(
  item_date date, category text, project_id uuid, project_number text, project_name text,
  description text, amount numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.can_view_portfolio(v_uid, _portfolio_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  RETURN QUERY
  WITH proj AS (
    SELECT p.id, p.project_number, p.project_name
    FROM public.project_portfolio_members m
    JOIN public.projects p ON p.id = m.project_id
    WHERE m.portfolio_id = _portfolio_id
  )
  SELECT om.updated_at::date, 'personal'::text, p.id, p.project_number, p.project_name,
         (COALESCE(s.service_name,'') || ' – ' || COALESCE(om.measurement_number,''))::text,
         ROUND((om.actual_duration_hours * COALESCE(s.hourly_rate,0))::numeric, 2)
    FROM public.order_measurements om
    JOIN public.measurement_orders mo ON mo.id = om.order_id
    JOIN public.measurement_services s ON s.id = om.service_id
    JOIN proj p ON p.id = mo.project_id
   WHERE COALESCE(om.actual_duration_hours,0) > 0
     AND (_start IS NULL OR om.updated_at::date >= _start)
     AND (_end   IS NULL OR om.updated_at::date <= _end)
  UNION ALL
  SELECT c.created_at::date, 'verbrauchsmaterial'::text, p.id, p.project_number, p.project_name,
         COALESCE(c.comment, ''), ROUND(COALESCE(c.total_cost,0)::numeric,2)
    FROM public.project_consumables c JOIN proj p ON p.id = c.project_id
   WHERE (_start IS NULL OR c.created_at::date >= _start) AND (_end IS NULL OR c.created_at::date <= _end)
  UNION ALL
  SELECT k.created_at::date, 'knetung'::text, p.id, p.project_number, p.project_name,
         COALESCE(k.comment, ''), ROUND(COALESCE(k.total_cost,0)::numeric,2)
    FROM public.project_knetung_materials k JOIN proj p ON p.id = k.project_id
   WHERE (_start IS NULL OR k.created_at::date >= _start) AND (_end IS NULL OR k.created_at::date <= _end)
  UNION ALL
  SELECT COALESCE(e.expense_date, e.created_at::date), 'aufwendung'::text, p.id, p.project_number, p.project_name,
         COALESCE(e.name, ''), ROUND(COALESCE(e.total_price,0)::numeric,2)
    FROM public.project_expenses e JOIN proj p ON p.id = e.project_id
   WHERE (_start IS NULL OR COALESCE(e.expense_date, e.created_at::date) >= _start)
     AND (_end   IS NULL OR COALESCE(e.expense_date, e.created_at::date) <= _end)
  ORDER BY 1 DESC;
END $$;

GRANT EXECUTE ON FUNCTION public.can_view_portfolio(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_summary(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_hours_by_project(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_hours_by_person(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_hours_by_month(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_costs_by_project(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_costs_by_month(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_person_journal(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_cost_journal(uuid, date, date) TO authenticated;
