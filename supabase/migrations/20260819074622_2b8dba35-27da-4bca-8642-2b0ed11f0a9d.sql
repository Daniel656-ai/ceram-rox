-- 1. Weekly reviews: allow multiple per week, optional texts, rating reason
ALTER TABLE public.project_weekly_reviews
  DROP CONSTRAINT IF EXISTS project_weekly_reviews_unique_per_week;

ALTER TABLE public.project_weekly_reviews
  ALTER COLUMN completed_this_week SET DEFAULT '',
  ALTER COLUMN currently_working_on SET DEFAULT '',
  ALTER COLUMN next_steps SET DEFAULT '',
  ALTER COLUMN help_needed SET DEFAULT '',
  ALTER COLUMN risks SET DEFAULT '',
  ALTER COLUMN other_comments SET DEFAULT '';

ALTER TABLE public.project_weekly_reviews
  ADD COLUMN IF NOT EXISTS rating_reason text NOT NULL DEFAULT '';

-- 2. Change log: entity metadata + reason
ALTER TABLE public.project_change_log
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'project',
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS entity_label text,
  ADD COLUMN IF NOT EXISTS reason text;

-- 3. Log project date changes (extend existing identity trigger function)
CREATE OR REPLACE FUNCTION public.log_project_identity_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.project_number IS DISTINCT FROM OLD.project_number THEN
    INSERT INTO public.project_change_log (project_id, changed_by, field_name, old_value, new_value, entity_type, entity_id)
    VALUES (NEW.id, auth.uid(), 'project_number', OLD.project_number, NEW.project_number, 'project', NEW.id);
  END IF;
  IF NEW.project_name IS DISTINCT FROM OLD.project_name THEN
    INSERT INTO public.project_change_log (project_id, changed_by, field_name, old_value, new_value, entity_type, entity_id)
    VALUES (NEW.id, auth.uid(), 'project_name', OLD.project_name, NEW.project_name, 'project', NEW.id);
  END IF;
  IF NEW.start_date IS DISTINCT FROM OLD.start_date THEN
    INSERT INTO public.project_change_log (project_id, changed_by, field_name, old_value, new_value, entity_type, entity_id)
    VALUES (NEW.id, auth.uid(), 'start_date', OLD.start_date::text, NEW.start_date::text, 'project_date', NEW.id);
  END IF;
  IF NEW.end_date IS DISTINCT FROM OLD.end_date THEN
    INSERT INTO public.project_change_log (project_id, changed_by, field_name, old_value, new_value, entity_type, entity_id)
    VALUES (NEW.id, auth.uid(), 'end_date', OLD.end_date::text, NEW.end_date::text, 'project_date', NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. Milestone date changes
CREATE OR REPLACE FUNCTION public.log_milestone_date_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.milestone_date IS DISTINCT FROM OLD.milestone_date THEN
    INSERT INTO public.project_change_log (project_id, changed_by, field_name, old_value, new_value, entity_type, entity_id, entity_label)
    VALUES (NEW.project_id, auth.uid(), 'milestone_date', OLD.milestone_date::text, NEW.milestone_date::text, 'milestone', NEW.id, NEW.title);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_log_milestone_date_changes ON public.project_milestones;
CREATE TRIGGER trg_log_milestone_date_changes
AFTER UPDATE ON public.project_milestones
FOR EACH ROW EXECUTE FUNCTION public.log_milestone_date_changes();

-- 5. Work package date changes
CREATE OR REPLACE FUNCTION public.log_work_package_date_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.start_date IS DISTINCT FROM OLD.start_date THEN
    INSERT INTO public.project_change_log (project_id, changed_by, field_name, old_value, new_value, entity_type, entity_id, entity_label)
    VALUES (NEW.project_id, auth.uid(), 'wp_start_date', OLD.start_date::text, NEW.start_date::text, 'work_package', NEW.id, NEW.title);
  END IF;
  IF NEW.end_date IS DISTINCT FROM OLD.end_date THEN
    INSERT INTO public.project_change_log (project_id, changed_by, field_name, old_value, new_value, entity_type, entity_id, entity_label)
    VALUES (NEW.project_id, auth.uid(), 'wp_end_date', OLD.end_date::text, NEW.end_date::text, 'work_package', NEW.id, NEW.title);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_log_wp_date_changes ON public.project_work_packages;
CREATE TRIGGER trg_log_wp_date_changes
AFTER UPDATE ON public.project_work_packages
FOR EACH ROW EXECUTE FUNCTION public.log_work_package_date_changes();