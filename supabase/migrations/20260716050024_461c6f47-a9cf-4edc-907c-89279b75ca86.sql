
-- Portfolio-Zeiterfassung: Erweiterung von project_time_entries
ALTER TABLE public.project_time_entries
  ALTER COLUMN project_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS portfolio_id uuid REFERENCES public.project_portfolios(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS portfolio_work_package_id uuid REFERENCES public.portfolio_work_packages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pte_portfolio_id ON public.project_time_entries(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_pte_portfolio_wp_id ON public.project_time_entries(portfolio_work_package_id);

-- Validierung: genau eine Zuordnung (Projekt ODER Portfolio)
CREATE OR REPLACE FUNCTION public.validate_time_entry_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.project_id IS NULL) = (NEW.portfolio_id IS NULL) THEN
    RAISE EXCEPTION 'Genau eines von project_id oder portfolio_id muss gesetzt sein.';
  END IF;

  IF NEW.portfolio_id IS NOT NULL THEN
    IF NEW.portfolio_work_package_id IS NULL THEN
      -- optional: erlauben ohne AP für Nachzuordnung
      NULL;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM public.portfolio_work_packages
        WHERE id = NEW.portfolio_work_package_id AND portfolio_id = NEW.portfolio_id
      ) THEN
        RAISE EXCEPTION 'Portfolio-Arbeitspaket gehört nicht zum gewählten Portfolio.';
      END IF;
    END IF;

    IF NEW.portfolio_task_id IS NOT NULL THEN
      IF NEW.portfolio_work_package_id IS NULL THEN
        RAISE EXCEPTION 'Portfolio-Task erfordert ein Portfolio-Arbeitspaket.';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.portfolio_tasks
        WHERE id = NEW.portfolio_task_id
          AND portfolio_work_package_id = NEW.portfolio_work_package_id
      ) THEN
        RAISE EXCEPTION 'Portfolio-Task gehört nicht zum gewählten Portfolio-AP.';
      END IF;
    END IF;

    -- Bei Portfolio-Zeitbuchungen darf kein Projekt-AP gesetzt sein
    IF NEW.work_package_id IS NOT NULL THEN
      RAISE EXCEPTION 'Bei Portfolio-Zeitbuchungen darf kein Projekt-Arbeitspaket gesetzt sein.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_time_entry_scope ON public.project_time_entries;
CREATE TRIGGER trg_validate_time_entry_scope
  BEFORE INSERT OR UPDATE ON public.project_time_entries
  FOR EACH ROW EXECUTE FUNCTION public.validate_time_entry_scope();

-- Helper: ist Benutzer PMO?
CREATE OR REPLACE FUNCTION public.is_pmo(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.custom_roles cr ON cr.id = ur.custom_role_id
    WHERE ur.user_id = _user_id
      AND lower(cr.name) = 'pmo'
  )
$$;

-- Zusätzliche Policy: Admin (master) und PMO dürfen Portfolio-Zeitbuchungen verwalten
DROP POLICY IF EXISTS "Master and PMO manage portfolio time entries" ON public.project_time_entries;
CREATE POLICY "Master and PMO manage portfolio time entries"
  ON public.project_time_entries
  FOR ALL
  USING (
    portfolio_id IS NOT NULL
    AND (public.has_role(auth.uid(), 'master'::app_role) OR public.is_pmo(auth.uid()))
  )
  WITH CHECK (
    portfolio_id IS NOT NULL
    AND (public.has_role(auth.uid(), 'master'::app_role) OR public.is_pmo(auth.uid()))
  );
