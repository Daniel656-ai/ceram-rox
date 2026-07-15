
-- Eindeutigkeit: ein Projekt-AP darf genau einem Portfolio-AP und genau einem Portfolio-Task zugeordnet sein.
ALTER TABLE public.portfolio_wp_project_wp_map
  DROP CONSTRAINT IF EXISTS portfolio_wp_project_wp_map_project_wp_unique;
ALTER TABLE public.portfolio_wp_project_wp_map
  ADD CONSTRAINT portfolio_wp_project_wp_map_project_wp_unique UNIQUE (project_work_package_id);

ALTER TABLE public.portfolio_task_project_wp_map
  DROP CONSTRAINT IF EXISTS portfolio_task_project_wp_map_project_wp_unique;
ALTER TABLE public.portfolio_task_project_wp_map
  ADD CONSTRAINT portfolio_task_project_wp_map_project_wp_unique UNIQUE (project_work_package_id);

-- Konsistenz: Task-Zuordnung muss zum selben Portfolio-AP gehören wie die WP-Zuordnung des Projekt-APs.
CREATE OR REPLACE FUNCTION public.check_portfolio_task_map_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_wp uuid;
  v_project_wp_mapped_to uuid;
BEGIN
  SELECT portfolio_work_package_id INTO v_task_wp
    FROM public.portfolio_tasks WHERE id = NEW.portfolio_task_id;
  IF v_task_wp IS NULL THEN
    RAISE EXCEPTION 'Portfolio-Task nicht gefunden';
  END IF;

  SELECT portfolio_work_package_id INTO v_project_wp_mapped_to
    FROM public.portfolio_wp_project_wp_map
    WHERE project_work_package_id = NEW.project_work_package_id;

  IF v_project_wp_mapped_to IS NOT NULL AND v_project_wp_mapped_to <> v_task_wp THEN
    RAISE EXCEPTION 'Projekt-AP ist bereits einem anderen Portfolio-Arbeitspaket zugeordnet. Task-Zuordnung nur innerhalb desselben Portfolio-APs erlaubt.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_portfolio_task_map_consistency ON public.portfolio_task_project_wp_map;
CREATE TRIGGER trg_check_portfolio_task_map_consistency
  BEFORE INSERT OR UPDATE ON public.portfolio_task_project_wp_map
  FOR EACH ROW EXECUTE FUNCTION public.check_portfolio_task_map_consistency();
