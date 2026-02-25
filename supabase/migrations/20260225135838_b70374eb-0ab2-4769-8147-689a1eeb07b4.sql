
-- ============================================================
-- 1. ENUM for absence types
-- ============================================================
CREATE TYPE public.absence_type AS ENUM ('urlaub', 'krankheit', 'weiterbildung', 'sonstiges');

-- ============================================================
-- 2. ENUM for downtime types
-- ============================================================
CREATE TYPE public.downtime_type AS ENUM ('wartung', 'reparatur', 'sonstiges');

-- ============================================================
-- 3. ENUM for downtime status
-- ============================================================
CREATE TYPE public.downtime_status AS ENUM ('geplant', 'aktiv', 'abgeschlossen');

-- ============================================================
-- 4. User absences table
-- ============================================================
CREATE TABLE public.user_absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  absence_type absence_type NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_absences ENABLE ROW LEVEL SECURITY;

-- Prevent overlapping absences for same user
CREATE OR REPLACE FUNCTION public.validate_no_overlapping_absence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM user_absences
    WHERE user_id = NEW.user_id
      AND id IS DISTINCT FROM NEW.id
      AND start_at < NEW.end_at
      AND end_at > NEW.start_at
  ) THEN
    RAISE EXCEPTION 'Überlappende Abwesenheit existiert bereits für diesen Zeitraum';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_no_overlapping_absence
  BEFORE INSERT OR UPDATE ON public.user_absences
  FOR EACH ROW EXECUTE FUNCTION public.validate_no_overlapping_absence();

-- updated_at trigger
CREATE TRIGGER update_user_absences_updated_at
  BEFORE UPDATE ON public.user_absences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: Users see own, masters see all
CREATE POLICY "Users see own absences"
  ON public.user_absences FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Users create own absences"
  ON public.user_absences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own absences, masters all"
  ON public.user_absences FOR UPDATE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Users delete own absences, masters all"
  ON public.user_absences FOR DELETE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'master'::app_role));

-- ============================================================
-- 5. Workstation downtimes table
-- ============================================================
CREATE TABLE public.workstation_downtimes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_id uuid NOT NULL REFERENCES public.workstations(id) ON DELETE CASCADE,
  downtime_type downtime_type NOT NULL,
  status downtime_status NOT NULL DEFAULT 'geplant',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  description text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workstation_downtimes ENABLE ROW LEVEL SECURITY;

-- Prevent overlapping downtimes for same workstation
CREATE OR REPLACE FUNCTION public.validate_no_overlapping_downtime()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM workstation_downtimes
    WHERE workstation_id = NEW.workstation_id
      AND id IS DISTINCT FROM NEW.id
      AND start_at < NEW.end_at
      AND end_at > NEW.start_at
  ) THEN
    RAISE EXCEPTION 'Überlappender Stillstand existiert bereits für diesen Zeitraum';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_no_overlapping_downtime
  BEFORE INSERT OR UPDATE ON public.workstation_downtimes
  FOR EACH ROW EXECUTE FUNCTION public.validate_no_overlapping_downtime();

-- updated_at trigger
CREATE TRIGGER update_workstation_downtimes_updated_at
  BEFORE UPDATE ON public.workstation_downtimes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: All authenticated read, masters manage
CREATE POLICY "All authenticated read downtimes"
  ON public.workstation_downtimes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Masters manage downtimes"
  ON public.workstation_downtimes FOR ALL
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- ============================================================
-- 6. Conflict check functions (server-side)
-- ============================================================

-- Check if a user is absent during a given period
CREATE OR REPLACE FUNCTION public.check_user_absence_conflict(
  _user_id uuid, _start timestamptz, _end timestamptz
)
RETURNS TABLE(id uuid, absence_type absence_type, start_at timestamptz, end_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, absence_type, start_at, end_at
  FROM user_absences
  WHERE user_id = _user_id
    AND start_at < _end
    AND end_at > _start;
$$;

-- Check if a workstation has downtime during a given period
CREATE OR REPLACE FUNCTION public.check_workstation_downtime_conflict(
  _workstation_id uuid, _start timestamptz, _end timestamptz
)
RETURNS TABLE(id uuid, downtime_type downtime_type, start_at timestamptz, end_at timestamptz, status downtime_status)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, downtime_type, start_at, end_at, status
  FROM workstation_downtimes
  WHERE workstation_id = _workstation_id
    AND start_at < _end
    AND end_at > _start
    AND status != 'abgeschlossen';
$$;
