
-- Enforce that project WPs mapped to portfolio structure belong to a project
-- that is a member of the target portfolio.

CREATE OR REPLACE FUNCTION public.check_portfolio_wp_map_project_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_portfolio_id uuid;
  v_project_id uuid;
BEGIN
  SELECT portfolio_id INTO v_portfolio_id
    FROM public.portfolio_work_packages
    WHERE id = NEW.portfolio_work_package_id;

  SELECT project_id INTO v_project_id
    FROM public.project_work_packages
    WHERE id = NEW.project_work_package_id;

  IF v_portfolio_id IS NULL OR v_project_id IS NULL THEN
    RAISE EXCEPTION 'Portfolio-AP oder Projekt-AP nicht gefunden.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.project_portfolio_members
    WHERE portfolio_id = v_portfolio_id AND project_id = v_project_id
  ) THEN
    RAISE EXCEPTION 'Das Projekt ist diesem Portfolio nicht zugeordnet – Zuordnung nicht erlaubt.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_portfolio_wp_map_membership ON public.portfolio_wp_project_wp_map;
CREATE TRIGGER trg_check_portfolio_wp_map_membership
  BEFORE INSERT OR UPDATE ON public.portfolio_wp_project_wp_map
  FOR EACH ROW EXECUTE FUNCTION public.check_portfolio_wp_map_project_membership();

CREATE OR REPLACE FUNCTION public.check_portfolio_task_map_project_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_portfolio_id uuid;
  v_project_id uuid;
BEGIN
  SELECT pwp.portfolio_id INTO v_portfolio_id
    FROM public.portfolio_tasks pt
    JOIN public.portfolio_work_packages pwp ON pwp.id = pt.portfolio_work_package_id
    WHERE pt.id = NEW.portfolio_task_id;

  SELECT project_id INTO v_project_id
    FROM public.project_work_packages
    WHERE id = NEW.project_work_package_id;

  IF v_portfolio_id IS NULL OR v_project_id IS NULL THEN
    RAISE EXCEPTION 'Portfolio-Task oder Projekt-AP nicht gefunden.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.project_portfolio_members
    WHERE portfolio_id = v_portfolio_id AND project_id = v_project_id
  ) THEN
    RAISE EXCEPTION 'Das Projekt ist diesem Portfolio nicht zugeordnet – Task-Zuordnung nicht erlaubt.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_portfolio_task_map_membership ON public.portfolio_task_project_wp_map;
CREATE TRIGGER trg_check_portfolio_task_map_membership
  BEFORE INSERT OR UPDATE ON public.portfolio_task_project_wp_map
  FOR EACH ROW EXECUTE FUNCTION public.check_portfolio_task_map_project_membership();
