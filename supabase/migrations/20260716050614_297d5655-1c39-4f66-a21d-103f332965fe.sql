
CREATE OR REPLACE FUNCTION public.check_portfolio_wp_map_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  pwp_cat uuid;
  proj_cat uuid;
BEGIN
  SELECT category_id INTO pwp_cat FROM public.portfolio_work_packages WHERE id = NEW.portfolio_work_package_id;
  SELECT category_id INTO proj_cat FROM public.project_work_packages WHERE id = NEW.project_work_package_id;

  IF pwp_cat IS NOT NULL AND proj_cat IS NOT NULL AND pwp_cat <> proj_cat THEN
    RAISE EXCEPTION 'Kategorie des Projekt-Arbeitspakets stimmt nicht mit der Kategorie des Portfolio-Arbeitspakets überein.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_portfolio_wp_map_category ON public.portfolio_wp_project_wp_map;
CREATE TRIGGER trg_check_portfolio_wp_map_category
  BEFORE INSERT OR UPDATE ON public.portfolio_wp_project_wp_map
  FOR EACH ROW EXECUTE FUNCTION public.check_portfolio_wp_map_category();

CREATE OR REPLACE FUNCTION public.check_portfolio_task_map_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  pwp_cat uuid;
  proj_cat uuid;
BEGIN
  SELECT pwp.category_id
    INTO pwp_cat
  FROM public.portfolio_tasks pt
  JOIN public.portfolio_work_packages pwp ON pwp.id = pt.portfolio_work_package_id
  WHERE pt.id = NEW.portfolio_task_id;

  SELECT category_id INTO proj_cat FROM public.project_work_packages WHERE id = NEW.project_work_package_id;

  IF pwp_cat IS NOT NULL AND proj_cat IS NOT NULL AND pwp_cat <> proj_cat THEN
    RAISE EXCEPTION 'Kategorie des Projekt-Arbeitspakets stimmt nicht mit der Kategorie des übergeordneten Portfolio-Arbeitspakets überein.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_portfolio_task_map_category ON public.portfolio_task_project_wp_map;
CREATE TRIGGER trg_check_portfolio_task_map_category
  BEFORE INSERT OR UPDATE ON public.portfolio_task_project_wp_map
  FOR EACH ROW EXECUTE FUNCTION public.check_portfolio_task_map_category();
