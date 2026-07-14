
ALTER TABLE public.portfolio_work_packages
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.portfolio_tasks
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'offen'
    CHECK (status IN ('offen','in_arbeit','erledigt'));

CREATE OR REPLACE FUNCTION public.get_portfolio_ffg_summary(_portfolio_id UUID)
RETURNS TABLE (
  work_package_id UUID,
  work_package_code TEXT,
  work_package_name TEXT,
  category_id UUID,
  category_name TEXT,
  hours NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    pwp.id,
    pwp.code,
    pwp.name,
    pwp.category_id,
    wpc.name,
    COALESCE(SUM(pte.duration_minutes) / 60.0, 0)::numeric AS hours
  FROM public.portfolio_work_packages pwp
  LEFT JOIN public.work_package_categories wpc ON wpc.id = pwp.category_id
  LEFT JOIN public.project_work_packages projwp ON projwp.category_id = pwp.category_id
  LEFT JOIN public.projects p ON p.id = projwp.project_id AND p.portfolio_id = _portfolio_id
  LEFT JOIN public.project_time_entries pte
    ON pte.work_package_id = projwp.id
   AND pte.project_id = p.id
  WHERE pwp.portfolio_id = _portfolio_id
  GROUP BY pwp.id, pwp.code, pwp.name, pwp.category_id, wpc.name, pwp.sort_order
  ORDER BY pwp.sort_order, pwp.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_portfolio_ffg_summary(UUID) TO authenticated;
