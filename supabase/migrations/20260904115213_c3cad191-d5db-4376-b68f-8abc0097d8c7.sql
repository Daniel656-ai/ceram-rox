-- =====================================================================
-- Zentrale, ID-basierte Zuordnung von Arbeitszeitbuchungen zu
-- Portfolio-Arbeitspaketen. Jede Buchung erscheint genau einmal.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.portfolio_time_allocation(
  _portfolio_id uuid, _start date DEFAULT NULL, _end date DEFAULT NULL
)
RETURNS TABLE(
  entry_id uuid, project_id uuid, project_number text, project_name text,
  project_work_package_id uuid, person_id uuid, entry_date date, minutes integer,
  portfolio_work_package_id uuid, portfolio_task_id uuid,
  category_id uuid, match_source text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
WITH proj AS (
  SELECT DISTINCT p.id, p.project_number, p.project_name
  FROM public.projects p
  WHERE p.portfolio_id = _portfolio_id
     OR EXISTS (SELECT 1 FROM public.project_portfolio_members m
                WHERE m.project_id = p.id AND m.portfolio_id = _portfolio_id)
),
te AS (
  SELECT t.*, proj.project_number, proj.project_name
  FROM public.project_time_entries t
  JOIN proj ON proj.id = t.project_id
  WHERE (_start IS NULL OR t.entry_date >= _start)
    AND (_end   IS NULL OR t.entry_date <= _end)
),
res AS (
  SELECT te.*,
    (SELECT w.id FROM public.portfolio_work_packages w
      WHERE w.id = te.portfolio_work_package_id AND w.portfolio_id = _portfolio_id) AS wp_direct,
    (SELECT w.id FROM public.portfolio_tasks pt
       JOIN public.portfolio_work_packages w ON w.id = pt.portfolio_work_package_id
      WHERE pt.id = te.portfolio_task_id AND w.portfolio_id = _portfolio_id) AS wp_task,
    (SELECT w.id FROM public.portfolio_wp_project_wp_map m
       JOIN public.portfolio_work_packages w ON w.id = m.portfolio_work_package_id
      WHERE m.project_work_package_id = te.work_package_id AND w.portfolio_id = _portfolio_id
      ORDER BY m.created_at LIMIT 1) AS wp_map,
    (SELECT w.id FROM public.portfolio_task_project_wp_map tm
       JOIN public.portfolio_tasks pt ON pt.id = tm.portfolio_task_id
       JOIN public.portfolio_work_packages w ON w.id = pt.portfolio_work_package_id
      WHERE tm.project_work_package_id = te.work_package_id AND w.portfolio_id = _portfolio_id
      ORDER BY tm.created_at LIMIT 1) AS wp_taskmap,
    (SELECT CASE WHEN count(*) = 1 THEN (array_agg(w.id))[1] END
       FROM public.portfolio_work_packages w
       JOIN public.project_work_packages pw
         ON pw.id = te.work_package_id AND pw.category_id = w.category_id
      WHERE w.portfolio_id = _portfolio_id) AS wp_cat
  FROM te
)
SELECT
  r.id, r.project_id, r.project_number, r.project_name, r.work_package_id,
  r.person_id, r.entry_date, r.duration_minutes,
  COALESCE(r.wp_direct, r.wp_task, r.wp_map, r.wp_taskmap, r.wp_cat),
  COALESCE(r.portfolio_task_id,
    (SELECT tm.portfolio_task_id FROM public.portfolio_task_project_wp_map tm
      WHERE tm.project_work_package_id = r.work_package_id ORDER BY tm.created_at LIMIT 1)),
  (SELECT w.category_id FROM public.portfolio_work_packages w
     WHERE w.id = COALESCE(r.wp_direct, r.wp_task, r.wp_map, r.wp_taskmap, r.wp_cat)),
  CASE
    WHEN r.wp_direct  IS NOT NULL THEN 'entry'
    WHEN r.wp_task    IS NOT NULL THEN 'task'
    WHEN r.wp_map     IS NOT NULL THEN 'wp_map'
    WHEN r.wp_taskmap IS NOT NULL THEN 'task_map'
    WHEN r.wp_cat     IS NOT NULL THEN 'category'
    ELSE 'unmapped'
  END
FROM res r;
$$;

REVOKE ALL ON FUNCTION public.portfolio_time_allocation(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portfolio_time_allocation(uuid, date, date) TO service_role;

-- ================= FFG-Zusammenfassung =================
DROP FUNCTION IF EXISTS public.get_portfolio_ffg_summary(uuid);
CREATE OR REPLACE FUNCTION public.get_portfolio_ffg_summary(
  _portfolio_id uuid, _start date DEFAULT NULL, _end date DEFAULT NULL
)
RETURNS TABLE(
  work_package_id uuid, work_package_code text, work_package_name text,
  category_id uuid, category_name text, hours numeric, entries_count integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.can_view_portfolio(v_uid, _portfolio_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  RETURN QUERY
  WITH alloc AS (
    SELECT * FROM public.portfolio_time_allocation(_portfolio_id, _start, _end)
  )
  SELECT pwp.id, pwp.code, pwp.name, pwp.category_id, wpc.name,
         ROUND(COALESCE(SUM(a.minutes), 0) / 60.0, 2),
         COUNT(a.entry_id)::int
  FROM public.portfolio_work_packages pwp
  LEFT JOIN public.work_package_categories wpc ON wpc.id = pwp.category_id
  LEFT JOIN alloc a ON a.portfolio_work_package_id = pwp.id
  WHERE pwp.portfolio_id = _portfolio_id
  GROUP BY pwp.id, pwp.code, pwp.name, pwp.category_id, wpc.name, pwp.sort_order

  UNION ALL
  -- Nicht zugeordnete Buchungen bleiben sichtbar, damit die Summe stimmt.
  SELECT NULL, NULL, 'Nicht zugeordnet', NULL, NULL,
         ROUND(SUM(a.minutes) / 60.0, 2), COUNT(*)::int, NULL
  FROM alloc a
  WHERE a.portfolio_work_package_id IS NULL
  HAVING COUNT(*) > 0;
END $$;

GRANT EXECUTE ON FUNCTION public.get_portfolio_ffg_summary(uuid, date, date) TO authenticated;

-- ================= Stunden je Portfolio-Arbeitspaket =================
DROP FUNCTION IF EXISTS public.get_portfolio_hours_by_work_package(uuid, date, date);
CREATE OR REPLACE FUNCTION public.get_portfolio_hours_by_work_package(
  _portfolio_id uuid, _start date DEFAULT NULL, _end date DEFAULT NULL
)
RETURNS TABLE(
  portfolio_work_package_id uuid, code text, name text,
  category_id uuid, category_name text, minutes bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH alloc AS (SELECT * FROM public.portfolio_time_allocation(_portfolio_id, _start, _end))
  SELECT pwp.id, pwp.code, pwp.name, pwp.category_id, wpc.name,
         COALESCE(SUM(a.minutes), 0)::bigint
  FROM public.portfolio_work_packages pwp
  LEFT JOIN public.work_package_categories wpc ON wpc.id = pwp.category_id
  LEFT JOIN alloc a ON a.portfolio_work_package_id = pwp.id
  WHERE pwp.portfolio_id = _portfolio_id
  GROUP BY pwp.id, pwp.code, pwp.name, pwp.category_id, wpc.name, pwp.sort_order
  ORDER BY pwp.sort_order, pwp.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_portfolio_hours_by_work_package(uuid, date, date) TO authenticated;

-- ================= Stunden je Kategorie =================
DROP FUNCTION IF EXISTS public.get_portfolio_hours_by_category(uuid, date, date);
CREATE OR REPLACE FUNCTION public.get_portfolio_hours_by_category(
  _portfolio_id uuid, _start date DEFAULT NULL, _end date DEFAULT NULL
)
RETURNS TABLE(category_id uuid, category_name text, minutes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH alloc AS (SELECT * FROM public.portfolio_time_allocation(_portfolio_id, _start, _end))
  SELECT wpc.id, wpc.name, COALESCE(SUM(a.minutes), 0)::bigint
  FROM public.work_package_categories wpc
  LEFT JOIN alloc a ON a.category_id = wpc.id
  WHERE EXISTS (SELECT 1 FROM public.portfolio_work_packages w
                WHERE w.portfolio_id = _portfolio_id AND w.category_id = wpc.id)
  GROUP BY wpc.id, wpc.name, wpc.sort_order

  UNION ALL
  SELECT NULL, 'Ohne Kategorie', SUM(a.minutes)::bigint
  FROM alloc a WHERE a.category_id IS NULL
  HAVING COUNT(*) > 0;
$$;

GRANT EXECUTE ON FUNCTION public.get_portfolio_hours_by_category(uuid, date, date) TO authenticated;

-- ================= Stunden je Task (inkl. Nummer) =================
DROP FUNCTION IF EXISTS public.get_portfolio_hours_by_task(uuid, date, date);
CREATE OR REPLACE FUNCTION public.get_portfolio_hours_by_task(
  _portfolio_id uuid, _start date DEFAULT NULL, _end date DEFAULT NULL
)
RETURNS TABLE(
  task_id uuid, task_code text, task_name text,
  work_package_id uuid, work_package_name text, minutes bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH alloc AS (SELECT * FROM public.portfolio_time_allocation(_portfolio_id, _start, _end))
  SELECT pt.id, pt.code, pt.name, pwp.id, pwp.name,
         COALESCE(SUM(a.minutes), 0)::bigint
  FROM public.portfolio_tasks pt
  JOIN public.portfolio_work_packages pwp ON pwp.id = pt.portfolio_work_package_id
  LEFT JOIN alloc a ON a.portfolio_task_id = pt.id
  WHERE pwp.portfolio_id = _portfolio_id
  GROUP BY pt.id, pt.code, pt.name, pwp.id, pwp.name, pwp.sort_order, pt.sort_order
  ORDER BY pwp.sort_order, pt.sort_order, pt.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_portfolio_hours_by_task(uuid, date, date) TO authenticated;

-- ================= Stunden je Mitarbeiter und Projekt =================
CREATE OR REPLACE FUNCTION public.get_portfolio_hours_by_person_project(
  _portfolio_id uuid, _start date DEFAULT NULL, _end date DEFAULT NULL
)
RETURNS TABLE(
  person_id uuid, person_name text, short_code text,
  project_id uuid, project_number text, project_name text,
  work_package_id uuid, work_package_name text,
  hours numeric, entries_count integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.can_view_portfolio(v_uid, _portfolio_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  RETURN QUERY
  WITH alloc AS (SELECT * FROM public.portfolio_time_allocation(_portfolio_id, _start, _end))
  SELECT a.person_id,
         COALESCE(NULLIF(TRIM(COALESCE(pr.first_name,'') || ' ' || COALESCE(pr.last_name,'')), ''), pr.email, 'Unbekannt'),
         pr.short_code,
         a.project_id, a.project_number, a.project_name,
         a.portfolio_work_package_id, pwp.name,
         ROUND(SUM(a.minutes) / 60.0, 2), COUNT(*)::int
  FROM alloc a
  LEFT JOIN public.profiles pr ON pr.user_id = a.person_id
  LEFT JOIN public.portfolio_work_packages pwp ON pwp.id = a.portfolio_work_package_id
  GROUP BY a.person_id, pr.first_name, pr.last_name, pr.email, pr.short_code,
           a.project_id, a.project_number, a.project_name, a.portfolio_work_package_id, pwp.name
  ORDER BY 2, 5;
END $$;

GRANT EXECUTE ON FUNCTION public.get_portfolio_hours_by_person_project(uuid, date, date) TO authenticated;

-- ================= Diagnose auffälliger Verknüpfungen =================
CREATE OR REPLACE FUNCTION public.get_portfolio_ffg_diagnostics(
  _portfolio_id uuid, _start date DEFAULT NULL, _end date DEFAULT NULL
)
RETURNS TABLE(issue text, severity text, reference text, detail text, hours numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.can_view_portfolio(v_uid, _portfolio_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  RETURN QUERY
  WITH alloc AS (SELECT * FROM public.portfolio_time_allocation(_portfolio_id, _start, _end))

  -- Buchungen ohne Zuordnung zu einem Portfolio-Arbeitspaket
  SELECT 'Buchung nicht im FFG-Bericht berücksichtigt', 'error',
         a.project_number, 'Buchung vom ' || a.entry_date || ' ohne Zuordnung zu einem Portfolio-Arbeitspaket',
         ROUND(SUM(a.minutes) / 60.0, 2)
  FROM alloc a WHERE a.portfolio_work_package_id IS NULL
  GROUP BY a.project_number, a.entry_date

  UNION ALL
  -- Buchung ohne Projekt-Arbeitspaket
  SELECT 'Buchung ohne Projekt-Arbeitspaket', 'error', a.project_number,
         'Buchung vom ' || a.entry_date, ROUND(SUM(a.minutes) / 60.0, 2)
  FROM alloc a WHERE a.project_work_package_id IS NULL
  GROUP BY a.project_number, a.entry_date

  UNION ALL
  -- Projekt im Portfolio, aber ohne Buchungen
  SELECT 'Projekt ohne Arbeitszeitbuchungen', 'info', p.project_number, p.project_name, 0::numeric
  FROM public.projects p
  WHERE (p.portfolio_id = _portfolio_id
     OR EXISTS (SELECT 1 FROM public.project_portfolio_members m
                WHERE m.project_id = p.id AND m.portfolio_id = _portfolio_id))
    AND NOT EXISTS (SELECT 1 FROM alloc a WHERE a.project_id = p.id)

  UNION ALL
  -- Portfolio-Arbeitspaket ohne Kategorie und ohne Zuordnung
  SELECT 'Portfolio-Arbeitspaket ohne Zuordnung', 'warning', pwp.code, pwp.name, 0::numeric
  FROM public.portfolio_work_packages pwp
  WHERE pwp.portfolio_id = _portfolio_id
    AND pwp.category_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.portfolio_wp_project_wp_map m
                    WHERE m.portfolio_work_package_id = pwp.id)

  UNION ALL
  -- Projekt-Arbeitspaket mehrfach auf Portfolio-Arbeitspakete gemappt
  SELECT 'Projekt-Arbeitspaket mehrfach zugeordnet', 'warning',
         pw.title, 'Zugeordnet zu ' || COUNT(*) || ' Portfolio-Arbeitspaketen', 0::numeric
  FROM public.portfolio_wp_project_wp_map m
  JOIN public.portfolio_work_packages w ON w.id = m.portfolio_work_package_id
  JOIN public.project_work_packages pw ON pw.id = m.project_work_package_id
  WHERE w.portfolio_id = _portfolio_id
  GROUP BY m.project_work_package_id, pw.title
  HAVING COUNT(*) > 1

  UNION ALL
  -- Mitarbeiter ohne Profil
  SELECT 'Mitarbeiter ohne Stammdatensatz', 'warning', a.person_id::text,
         'Buchungen vorhanden, aber kein Benutzerprofil gefunden', ROUND(SUM(a.minutes) / 60.0, 2)
  FROM alloc a
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.user_id = a.person_id)
  GROUP BY a.person_id;
END $$;

GRANT EXECUTE ON FUNCTION public.get_portfolio_ffg_diagnostics(uuid, date, date) TO authenticated;