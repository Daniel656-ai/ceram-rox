CREATE OR REPLACE FUNCTION public.get_portfolio_controlling_report(_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_start date := nullif(_filters->>'start','')::date;
  v_end date := nullif(_filters->>'end','')::date;
  v_portfolio_ids uuid[];
  v_project_ids uuid[];
  v_category_ids uuid[];
  v_leader_ids uuid[];
  v_person_ids uuid[];
  v_wp_ids uuid[];
  v_task_ids uuid[];
  v_cost_centers text[];
  v_statuses text[];
  v_funding text := nullif(_filters->>'funding','');
  v_struct boolean := false;
  v_pers boolean := false;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Nicht angemeldet'; END IF;

  SELECT array_agg(x::uuid) INTO v_portfolio_ids FROM jsonb_array_elements_text(coalesce(_filters->'portfolio_ids','[]'::jsonb)) x;
  SELECT array_agg(x::uuid) INTO v_project_ids   FROM jsonb_array_elements_text(coalesce(_filters->'project_ids','[]'::jsonb)) x;
  SELECT array_agg(x::uuid) INTO v_category_ids  FROM jsonb_array_elements_text(coalesce(_filters->'category_ids','[]'::jsonb)) x;
  SELECT array_agg(x::uuid) INTO v_leader_ids    FROM jsonb_array_elements_text(coalesce(_filters->'leader_ids','[]'::jsonb)) x;
  SELECT array_agg(x::uuid) INTO v_person_ids    FROM jsonb_array_elements_text(coalesce(_filters->'person_ids','[]'::jsonb)) x;
  SELECT array_agg(x::uuid) INTO v_wp_ids        FROM jsonb_array_elements_text(coalesce(_filters->'work_package_ids','[]'::jsonb)) x;
  SELECT array_agg(x::uuid) INTO v_task_ids      FROM jsonb_array_elements_text(coalesce(_filters->'task_ids','[]'::jsonb)) x;
  SELECT array_agg(x)       INTO v_cost_centers  FROM jsonb_array_elements_text(coalesce(_filters->'cost_centers','[]'::jsonb)) x;
  SELECT array_agg(x)       INTO v_statuses      FROM jsonb_array_elements_text(coalesce(_filters->'statuses','[]'::jsonb)) x;

  v_struct := (v_wp_ids IS NOT NULL OR v_task_ids IS NOT NULL OR v_cost_centers IS NOT NULL);
  v_pers := public.has_role(v_uid,'master'::app_role)
         OR public.has_permission(v_uid,'costs.view_personnel')
         OR public.has_permission(v_uid,'costs.manage');

  WITH scope_pf AS (
    SELECT p.id, p.name, coalesce(p.funding_program,'') AS funding_program
    FROM public.project_portfolios p
    WHERE public.can_view_portfolio(v_uid, p.id)
      AND (v_portfolio_ids IS NULL OR p.id = ANY(v_portfolio_ids))
  ),
  proj_pf AS (
    SELECT DISTINCT m.project_id, m.portfolio_id
    FROM public.project_portfolio_members m
    JOIN scope_pf s ON s.id = m.portfolio_id
    UNION
    SELECT p.id, p.portfolio_id
    FROM public.projects p
    JOIN scope_pf s ON s.id = p.portfolio_id
  ),
  proj_base AS (
    SELECT DISTINCT p.id, p.project_number, p.project_name,
           p.project_status::text AS status,
           coalesce(p.budget_total,0)::numeric AS budget_total,
           EXISTS (
             SELECT 1 FROM proj_pf x
             JOIN public.project_portfolios pf ON pf.id = x.portfolio_id
             WHERE x.project_id = p.id AND coalesce(pf.funding_program,'') <> ''
           ) AS funded
    FROM public.projects p
    JOIN proj_pf pp ON pp.project_id = p.id
    WHERE (v_project_ids IS NULL OR p.id = ANY(v_project_ids))
      AND (v_statuses IS NULL OR p.project_status::text = ANY(v_statuses))
      AND (v_leader_ids IS NULL OR EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = p.id AND pm.user_id = ANY(v_leader_ids)
              AND pm.role IN ('owner'::project_role,'leader'::project_role)))
      AND (v_category_ids IS NULL OR EXISTS (
            SELECT 1 FROM public.project_work_packages w
            WHERE w.project_id = p.id AND w.category_id = ANY(v_category_ids)))
  ),
  proj AS (
    SELECT * FROM proj_base
    WHERE v_funding IS NULL
       OR (v_funding = 'ja' AND funded)
       OR (v_funding = 'nein' AND NOT funded)
  ),
  te AS (
    SELECT t.id, t.project_id, t.person_id, t.entry_date,
           (t.duration_minutes/60.0)::numeric AS hours,
           coalesce(t.entry_type,'arbeit') AS entry_type, t.note,
           t.work_package_id, t.portfolio_work_package_id, t.portfolio_task_id
    FROM public.project_time_entries t
    JOIN proj pr ON pr.id = t.project_id
    WHERE (v_start IS NULL OR t.entry_date >= v_start)
      AND (v_end IS NULL OR t.entry_date <= v_end)
      AND (v_person_ids IS NULL OR t.person_id = ANY(v_person_ids))
      AND (v_wp_ids IS NULL OR t.work_package_id = ANY(v_wp_ids) OR t.portfolio_work_package_id = ANY(v_wp_ids))
      AND (v_task_ids IS NULL OR t.portfolio_task_id = ANY(v_task_ids))
  ),
  te_x AS (
    SELECT te.*,
           pr.project_number, pr.project_name,
           coalesce(pf.first_name || ' ' || pf.last_name, pf.short_code, 'Unbekannt') AS person_name,
           pf.short_code,
           coalesce(pw.id::text, pfw.id::text, 'none') AS wp_key,
           coalesce(pw.title, pfw.name, 'Ohne Arbeitspaket') AS wp_name,
           coalesce(te.portfolio_task_id::text,'none') AS task_key,
           coalesce(pt.name, 'Ohne Task') AS task_name,
           coalesce(c1.name, c2.name, 'Ohne Schwerpunkt') AS focus_name
    FROM te
    JOIN proj pr ON pr.id = te.project_id
    LEFT JOIN public.profiles pf ON pf.user_id = te.person_id
    LEFT JOIN public.project_work_packages pw ON pw.id = te.work_package_id
    LEFT JOIN public.portfolio_work_packages pfw ON pfw.id = te.portfolio_work_package_id
    LEFT JOIN public.portfolio_tasks pt ON pt.id = te.portfolio_task_id
    LEFT JOIN public.work_package_categories c1 ON c1.id = pw.category_id
    LEFT JOIN public.work_package_categories c2 ON c2.id = pfw.category_id
  ),
  cost_rows AS (
    SELECT 'personal'::text AS kind, 'Personalkosten (Dienstleistungen)'::text AS cat_label,
           'measurement'::text AS source, mo.project_id,
           coalesce(om.planned_end_date, om.planned_start_date, om.due_date, mo.due_date, mo.created_at::date) AS item_date,
           (coalesce(om.actual_duration_hours, om.planned_hours, 0) * coalesce(s.hourly_rate,0))::numeric AS amount,
           NULL::uuid AS wp_id, NULL::text AS cost_center,
           coalesce(s.name,'Dienstleistung') AS description
    FROM public.order_measurements om
    JOIN public.measurement_orders mo ON mo.id = om.order_id
    JOIN proj pr ON pr.id = mo.project_id
    JOIN public.measurement_services s ON s.id = om.service_id
    WHERE v_pers AND NOT v_struct
      AND (v_person_ids IS NULL OR om.assigned_to = ANY(v_person_ids))
      AND (v_start IS NULL OR coalesce(om.planned_end_date, om.planned_start_date, om.due_date, mo.due_date, mo.created_at::date) >= v_start)
      AND (v_end IS NULL OR coalesce(om.planned_end_date, om.planned_start_date, om.due_date, mo.due_date, mo.created_at::date) <= v_end)

    UNION ALL
    SELECT 'material', 'Verbrauchsmaterial', 'consumable', pc.project_id, pc.created_at::date,
           coalesce(pc.total_cost, pc.quantity*pc.unit_price, 0)::numeric, NULL, NULL,
           coalesce(pc.comment,'Verbrauchsmaterial')
    FROM public.project_consumables pc
    JOIN proj pr ON pr.id = pc.project_id
    WHERE NOT v_struct AND v_person_ids IS NULL
      AND (v_start IS NULL OR pc.created_at::date >= v_start)
      AND (v_end IS NULL OR pc.created_at::date <= v_end)

    UNION ALL
    SELECT 'material', 'Rohstoffe / Knetung', 'knetung', pk.project_id, pk.created_at::date,
           coalesce(pk.total_cost, pk.quantity_kg*pk.price_per_kg, 0)::numeric, NULL, NULL,
           coalesce(pk.comment,'Knetung')
    FROM public.project_knetung_materials pk
    JOIN proj pr ON pr.id = pk.project_id
    WHERE NOT v_struct AND v_person_ids IS NULL
      AND (v_start IS NULL OR pk.created_at::date >= v_start)
      AND (v_end IS NULL OR pk.created_at::date <= v_end)

    UNION ALL
    SELECT CASE
             WHEN ec.key = 'personalaufwand' THEN 'personal'
             WHEN ec.key IN ('externe_analytik','externe_dienstleistungen','zertifizierungen') THEN 'fremdleistung'
             WHEN ec.key IN ('reisekosten','transport_versand') THEN 'reise'
             WHEN ec.key IN ('verbrauchsmaterialien','verpackungsmaterial','rohstoffe_projekt','laborchemikalien','referenzmaterialien','muster','pruefmittel') THEN 'material'
             ELSE 'sonstige'
           END,
           coalesce(ec.name_de,'Sonstige Projektkosten'), 'expense', pe.project_id,
           coalesce(pe.expense_date, pe.created_at::date),
           coalesce(pe.total_price, pe.quantity*pe.unit_price, 0)::numeric,
           pe.work_package_id, pe.cost_center,
           coalesce(nullif(pe.name,''), nullif(pe.description,''), 'Aufwendung')
    FROM public.project_expenses pe
    JOIN proj pr ON pr.id = pe.project_id
    LEFT JOIN public.project_expense_categories ec ON ec.id = pe.category_id
    WHERE v_person_ids IS NULL AND v_task_ids IS NULL
      AND (v_wp_ids IS NULL OR pe.work_package_id = ANY(v_wp_ids))
      AND (v_cost_centers IS NULL OR pe.cost_center = ANY(v_cost_centers))
      AND (v_start IS NULL OR coalesce(pe.expense_date, pe.created_at::date) >= v_start)
      AND (v_end IS NULL OR coalesce(pe.expense_date, pe.created_at::date) <= v_end)
  ),
  cost_x AS (
    SELECT cr.*, pr.project_number, pr.project_name,
           coalesce(pw.id::text,'none') AS wp_key,
           coalesce(pw.title,'Ohne Arbeitspaket') AS wp_name,
           coalesce(c.name,'Ohne Schwerpunkt') AS focus_name
    FROM cost_rows cr
    JOIN proj pr ON pr.id = cr.project_id
    LEFT JOIN public.project_work_packages pw ON pw.id = cr.wp_id
    LEFT JOIN public.work_package_categories c ON c.id = pw.category_id
  ),
  orders_scope AS (
    SELECT mo.id, mo.project_id, mo.status::text AS status, mo.created_at, mo.updated_at
    FROM public.measurement_orders mo
    JOIN proj pr ON pr.id = mo.project_id
    WHERE (v_start IS NULL OR mo.created_at::date >= v_start)
      AND (v_end IS NULL OR mo.created_at::date <= v_end)
  ),
  kpi AS (
    SELECT
      (SELECT count(*) FROM proj) AS project_count,
      (SELECT count(*) FROM proj WHERE status = 'active') AS active_count,
      (SELECT count(*) FROM proj WHERE status = 'completed') AS closed_count,
      (SELECT count(DISTINCT person_id) FROM te) AS people_count,
      (SELECT count(*) FROM public.project_work_packages w JOIN proj pr ON pr.id = w.project_id
         WHERE v_category_ids IS NULL OR w.category_id = ANY(v_category_ids)) AS wp_count,
      (SELECT count(*) FROM public.portfolio_tasks pt
         JOIN public.portfolio_work_packages pw ON pw.id = pt.portfolio_work_package_id
         JOIN scope_pf s ON s.id = pw.portfolio_id
         WHERE v_task_ids IS NULL OR pt.id = ANY(v_task_ids)) AS task_count,
      (SELECT count(*) FROM public.samples sa JOIN proj pr ON pr.id = sa.project_id
         WHERE (v_start IS NULL OR sa.created_at::date >= v_start)
           AND (v_end IS NULL OR sa.created_at::date <= v_end)) AS sample_count,
      (SELECT count(*) FROM public.order_measurements om
         JOIN public.measurement_orders mo ON mo.id = om.order_id
         JOIN proj pr ON pr.id = mo.project_id
         WHERE (v_start IS NULL OR om.created_at::date >= v_start)
           AND (v_end IS NULL OR om.created_at::date <= v_end)) AS service_count,
      (SELECT count(*) FROM orders_scope WHERE status = 'completed') AS orders_completed,
      (SELECT count(*) FROM orders_scope) AS orders_total,
      (SELECT round(avg(extract(epoch FROM (updated_at - created_at))/86400.0)::numeric, 1)
         FROM orders_scope WHERE status = 'completed') AS avg_lead_days
  ),
  months AS (
    SELECT m.month,
           coalesce(h.hours,0) AS hours,
           coalesce(c.personal,0) AS personal,
           coalesce(c.material,0) AS material,
           coalesce(c.fremd,0) AS fremd,
           coalesce(c.reise,0) AS reise,
           coalesce(c.sonstige,0) AS sonstige,
           coalesce(c.total,0) AS total
    FROM (
      SELECT DISTINCT to_char(entry_date,'YYYY-MM') AS month FROM te
      UNION SELECT DISTINCT to_char(item_date,'YYYY-MM') FROM cost_rows WHERE item_date IS NOT NULL
    ) m
    LEFT JOIN (
      SELECT to_char(entry_date,'YYYY-MM') AS month, round(sum(hours),2) AS hours FROM te GROUP BY 1
    ) h ON h.month = m.month
    LEFT JOIN (
      SELECT to_char(item_date,'YYYY-MM') AS month,
             round(sum(amount) FILTER (WHERE kind='personal'),2) AS personal,
             round(sum(amount) FILTER (WHERE kind='material'),2) AS material,
             round(sum(amount) FILTER (WHERE kind='fremdleistung'),2) AS fremd,
             round(sum(amount) FILTER (WHERE kind='reise'),2) AS reise,
             round(sum(amount) FILTER (WHERE kind='sonstige'),2) AS sonstige,
             round(sum(amount),2) AS total
      FROM cost_rows WHERE item_date IS NOT NULL GROUP BY 1
    ) c ON c.month = m.month
  )
  SELECT jsonb_build_object(
    'can_view_personnel_costs', v_pers,
    'summary', jsonb_build_object(
      'hours_total', coalesce((SELECT round(sum(hours),2) FROM te),0),
      'entries_count', (SELECT count(*) FROM te),
      'people_count', (SELECT people_count FROM kpi),
      'project_count', (SELECT project_count FROM kpi),
      'active_count', (SELECT active_count FROM kpi),
      'closed_count', (SELECT closed_count FROM kpi),
      'wp_count', (SELECT wp_count FROM kpi),
      'task_count', (SELECT task_count FROM kpi),
      'sample_count', (SELECT sample_count FROM kpi),
      'service_count', (SELECT service_count FROM kpi),
      'orders_completed', (SELECT orders_completed FROM kpi),
      'orders_total', (SELECT orders_total FROM kpi),
      'avg_lead_days', (SELECT avg_lead_days FROM kpi),
      'personnel_cost', coalesce((SELECT round(sum(amount),2) FROM cost_rows WHERE kind='personal'),0),
      'material_cost', coalesce((SELECT round(sum(amount),2) FROM cost_rows WHERE kind='material'),0),
      'external_cost', coalesce((SELECT round(sum(amount),2) FROM cost_rows WHERE kind='fremdleistung'),0),
      'travel_cost', coalesce((SELECT round(sum(amount),2) FROM cost_rows WHERE kind='reise'),0),
      'other_cost', coalesce((SELECT round(sum(amount),2) FROM cost_rows WHERE kind='sonstige'),0),
      'expenses_cost', coalesce((SELECT round(sum(amount),2) FROM cost_rows WHERE source='expense'),0),
      'cost_total', coalesce((SELECT round(sum(amount),2) FROM cost_rows),0),
      'budget_total', coalesce((SELECT round(sum(budget_total),2) FROM proj),0),
      'budget_remaining', coalesce((SELECT round(sum(budget_total),2) FROM proj),0) - coalesce((SELECT round(sum(amount),2) FROM cost_rows),0)
    ),
    'hours_by_project', coalesce((SELECT jsonb_agg(x ORDER BY x->>'label') FROM (
        SELECT jsonb_build_object('id', project_id, 'code', project_number, 'label', project_name,
                                  'hours', round(sum(hours),2), 'entries', count(*)) AS x
        FROM te_x GROUP BY project_id, project_number, project_name) q),'[]'::jsonb),
    'hours_by_person', coalesce((SELECT jsonb_agg(x ORDER BY (x->>'hours')::numeric DESC) FROM (
        SELECT jsonb_build_object('id', person_id, 'code', short_code, 'label', person_name,
                                  'hours', round(sum(hours),2), 'entries', count(*),
                                  'projects', count(DISTINCT project_id)) AS x
        FROM te_x GROUP BY person_id, short_code, person_name) q),'[]'::jsonb),
    'hours_by_work_package', coalesce((SELECT jsonb_agg(x ORDER BY (x->>'hours')::numeric DESC) FROM (
        SELECT jsonb_build_object('id', wp_key, 'label', wp_name, 'hours', round(sum(hours),2)) AS x
        FROM te_x GROUP BY wp_key, wp_name) q),'[]'::jsonb),
    'hours_by_task', coalesce((SELECT jsonb_agg(x ORDER BY (x->>'hours')::numeric DESC) FROM (
        SELECT jsonb_build_object('id', task_key, 'label', task_name, 'hours', round(sum(hours),2)) AS x
        FROM te_x GROUP BY task_key, task_name) q),'[]'::jsonb),
    'hours_by_focus', coalesce((SELECT jsonb_agg(x ORDER BY (x->>'hours')::numeric DESC) FROM (
        SELECT jsonb_build_object('label', focus_name, 'hours', round(sum(hours),2)) AS x
        FROM te_x GROUP BY focus_name) q),'[]'::jsonb),
    'costs_by_project', coalesce((SELECT jsonb_agg(x ORDER BY x->>'code') FROM (
        SELECT jsonb_build_object('id', pr.id, 'code', pr.project_number, 'label', pr.project_name,
          'hours', coalesce((SELECT round(sum(hours),2) FROM te WHERE te.project_id = pr.id),0),
          'personnel', coalesce((SELECT round(sum(amount),2) FROM cost_rows c WHERE c.project_id=pr.id AND kind='personal'),0),
          'material', coalesce((SELECT round(sum(amount),2) FROM cost_rows c WHERE c.project_id=pr.id AND kind='material'),0),
          'external', coalesce((SELECT round(sum(amount),2) FROM cost_rows c WHERE c.project_id=pr.id AND kind='fremdleistung'),0),
          'travel', coalesce((SELECT round(sum(amount),2) FROM cost_rows c WHERE c.project_id=pr.id AND kind='reise'),0),
          'other', coalesce((SELECT round(sum(amount),2) FROM cost_rows c WHERE c.project_id=pr.id AND kind='sonstige'),0),
          'total', coalesce((SELECT round(sum(amount),2) FROM cost_rows c WHERE c.project_id=pr.id),0),
          'budget', pr.budget_total,
          'funded', pr.funded, 'status', pr.status) AS x
        FROM proj pr) q),'[]'::jsonb),
    'costs_by_work_package', coalesce((SELECT jsonb_agg(x ORDER BY (x->>'total')::numeric DESC) FROM (
        SELECT jsonb_build_object('id', wp_key, 'label', wp_name, 'total', round(sum(amount),2)) AS x
        FROM cost_x GROUP BY wp_key, wp_name) q),'[]'::jsonb),
    'costs_by_category', coalesce((SELECT jsonb_agg(x ORDER BY (x->>'total')::numeric DESC) FROM (
        SELECT jsonb_build_object('kind', kind, 'label', cat_label, 'total', round(sum(amount),2)) AS x
        FROM cost_x GROUP BY kind, cat_label) q),'[]'::jsonb),
    'by_month', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'month', month, 'hours', hours, 'personal', personal, 'material', material,
        'external', fremd, 'travel', reise, 'other', sonstige, 'total', total) ORDER BY month) FROM months),'[]'::jsonb),
    'hours_journal', coalesce((SELECT jsonb_agg(x ORDER BY x->>'date' DESC) FROM (
        SELECT jsonb_build_object('id', id, 'date', entry_date, 'project_number', project_number,
          'project_name', project_name, 'person', person_name, 'work_package', wp_name,
          'task', task_name, 'focus', focus_name, 'type', entry_type,
          'hours', round(hours,2), 'note', note) AS x
        FROM te_x LIMIT 5000) q),'[]'::jsonb),
    'cost_journal', coalesce((SELECT jsonb_agg(x ORDER BY x->>'date' DESC) FROM (
        SELECT jsonb_build_object('date', item_date, 'kind', kind, 'category', cat_label,
          'project_number', project_number, 'project_name', project_name, 'work_package', wp_name,
          'cost_center', cost_center, 'description', description, 'amount', round(amount,2)) AS x
        FROM cost_x LIMIT 5000) q),'[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_portfolio_controlling_report(jsonb) TO authenticated;