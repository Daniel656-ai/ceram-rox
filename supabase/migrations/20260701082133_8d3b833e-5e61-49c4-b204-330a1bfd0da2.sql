
-- 1) Milestones can optionally belong to a work package
ALTER TABLE public.project_milestones
  ADD COLUMN IF NOT EXISTS work_package_id uuid NULL REFERENCES public.project_work_packages(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_project_milestones_wp ON public.project_milestones(work_package_id);

-- 2) Dependency type enum
DO $$ BEGIN
  CREATE TYPE public.wp_dependency_type AS ENUM ('FS','FF','SS','SF');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Dependency table
CREATE TABLE IF NOT EXISTS public.project_work_package_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  predecessor_id uuid NOT NULL REFERENCES public.project_work_packages(id) ON DELETE CASCADE,
  successor_id uuid NOT NULL REFERENCES public.project_work_packages(id) ON DELETE CASCADE,
  dependency_type public.wp_dependency_type NOT NULL DEFAULT 'FS',
  lag_days integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wpdep_no_self CHECK (predecessor_id <> successor_id),
  CONSTRAINT wpdep_unique UNIQUE (predecessor_id, successor_id, dependency_type)
);

CREATE INDEX IF NOT EXISTS idx_wpdep_pred ON public.project_work_package_dependencies(predecessor_id);
CREATE INDEX IF NOT EXISTS idx_wpdep_succ ON public.project_work_package_dependencies(successor_id);
CREATE INDEX IF NOT EXISTS idx_wpdep_project ON public.project_work_package_dependencies(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_work_package_dependencies TO authenticated;
GRANT ALL ON public.project_work_package_dependencies TO service_role;

ALTER TABLE public.project_work_package_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members see wp dependencies" ON public.project_work_package_dependencies;
CREATE POLICY "Members see wp dependencies"
  ON public.project_work_package_dependencies FOR SELECT
  USING (has_role(auth.uid(), 'master'::app_role) OR is_project_member(auth.uid(), project_id));

DROP POLICY IF EXISTS "Leader manage wp dependencies" ON public.project_work_package_dependencies;
CREATE POLICY "Leader manage wp dependencies"
  ON public.project_work_package_dependencies FOR ALL
  USING (has_role(auth.uid(), 'master'::app_role) OR has_project_role(auth.uid(), project_id, 'leader'::project_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR has_project_role(auth.uid(), project_id, 'leader'::project_role));

-- 4) Cycle detection
CREATE OR REPLACE FUNCTION public.check_wp_dependency_cycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_cycle boolean;
BEGIN
  IF NEW.predecessor_id = NEW.successor_id THEN
    RAISE EXCEPTION 'Ein Arbeitspaket kann nicht von sich selbst abhängen';
  END IF;
  -- Would adding predecessor -> successor create a cycle?
  -- i.e. is there already a path successor -> ... -> predecessor?
  WITH RECURSIVE reach AS (
    SELECT successor_id AS node FROM public.project_work_package_dependencies
      WHERE predecessor_id = NEW.successor_id
        AND id IS DISTINCT FROM NEW.id
    UNION
    SELECT d.successor_id
      FROM public.project_work_package_dependencies d
      JOIN reach r ON r.node = d.predecessor_id
      WHERE d.id IS DISTINCT FROM NEW.id
  )
  SELECT EXISTS(SELECT 1 FROM reach WHERE node = NEW.predecessor_id) INTO v_cycle;
  IF v_cycle THEN
    RAISE EXCEPTION 'Zyklische Abhängigkeit erkannt';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_wpdep_cycle ON public.project_work_package_dependencies;
CREATE TRIGGER trg_wpdep_cycle
  BEFORE INSERT OR UPDATE ON public.project_work_package_dependencies
  FOR EACH ROW EXECUTE FUNCTION public.check_wp_dependency_cycle();

-- 5) Propagation trigger on work packages
CREATE OR REPLACE FUNCTION public.propagate_wp_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dep RECORD;
  succ RECORD;
  new_start date;
  new_end date;
  duration_days integer;
BEGIN
  IF (OLD.start_date IS NOT DISTINCT FROM NEW.start_date)
     AND (OLD.end_date IS NOT DISTINCT FROM NEW.end_date) THEN
    RETURN NEW;
  END IF;

  FOR dep IN
    SELECT * FROM public.project_work_package_dependencies WHERE predecessor_id = NEW.id
  LOOP
    SELECT * INTO succ FROM public.project_work_packages WHERE id = dep.successor_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;

    duration_days := NULL;
    IF succ.start_date IS NOT NULL AND succ.end_date IS NOT NULL THEN
      duration_days := (succ.end_date - succ.start_date);
    END IF;

    new_start := succ.start_date;
    new_end   := succ.end_date;

    IF dep.dependency_type = 'FS' AND NEW.end_date IS NOT NULL THEN
      new_start := (NEW.end_date + 1 + dep.lag_days);
    ELSIF dep.dependency_type = 'SS' AND NEW.start_date IS NOT NULL THEN
      new_start := (NEW.start_date + dep.lag_days);
    ELSIF dep.dependency_type = 'FF' AND NEW.end_date IS NOT NULL THEN
      new_end := (NEW.end_date + dep.lag_days);
    ELSIF dep.dependency_type = 'SF' AND NEW.start_date IS NOT NULL THEN
      new_end := (NEW.start_date + dep.lag_days);
    END IF;

    -- Preserve duration when we set start (FS/SS)
    IF dep.dependency_type IN ('FS','SS') AND duration_days IS NOT NULL AND new_start IS NOT NULL THEN
      new_end := (new_start + duration_days);
    END IF;
    -- Preserve duration when we set end (FF/SF)
    IF dep.dependency_type IN ('FF','SF') AND duration_days IS NOT NULL AND new_end IS NOT NULL THEN
      new_start := (new_end - duration_days);
    END IF;

    IF (new_start IS DISTINCT FROM succ.start_date) OR (new_end IS DISTINCT FROM succ.end_date) THEN
      UPDATE public.project_work_packages
         SET start_date = new_start,
             end_date   = new_end,
             updated_at = now()
       WHERE id = succ.id;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_wp_propagate ON public.project_work_packages;
CREATE TRIGGER trg_wp_propagate
  AFTER UPDATE OF start_date, end_date ON public.project_work_packages
  FOR EACH ROW EXECUTE FUNCTION public.propagate_wp_schedule();
