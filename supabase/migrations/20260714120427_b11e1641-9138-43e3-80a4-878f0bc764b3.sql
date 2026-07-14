
CREATE OR REPLACE FUNCTION public.sync_projects_from_ppm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.projects SET portfolio_id = NEW.portfolio_id WHERE id = NEW.project_id AND portfolio_id IS DISTINCT FROM NEW.portfolio_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.projects SET portfolio_id = NEW.portfolio_id WHERE id = NEW.project_id AND portfolio_id IS DISTINCT FROM NEW.portfolio_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.projects SET portfolio_id = NULL WHERE id = OLD.project_id AND portfolio_id = OLD.portfolio_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_sync_projects_from_ppm ON public.project_portfolio_members;
CREATE TRIGGER trg_sync_projects_from_ppm
  AFTER INSERT OR UPDATE OR DELETE ON public.project_portfolio_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_projects_from_ppm();
