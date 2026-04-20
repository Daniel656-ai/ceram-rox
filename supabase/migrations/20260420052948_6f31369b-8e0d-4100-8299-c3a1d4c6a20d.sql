-- Tabelle für individuelle Arbeitszeitmodelle
CREATE TABLE public.user_work_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  weekly_hours numeric NOT NULL DEFAULT 38.5,
  works_monday boolean NOT NULL DEFAULT true,
  works_tuesday boolean NOT NULL DEFAULT true,
  works_wednesday boolean NOT NULL DEFAULT true,
  works_thursday boolean NOT NULL DEFAULT true,
  works_friday boolean NOT NULL DEFAULT true,
  works_saturday boolean NOT NULL DEFAULT false,
  works_sunday boolean NOT NULL DEFAULT false,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, valid_from)
);

CREATE INDEX idx_user_work_schedules_user_valid ON public.user_work_schedules (user_id, valid_from DESC);

ALTER TABLE public.user_work_schedules ENABLE ROW LEVEL SECURITY;

-- RLS: User sieht eigene, Master sieht/managed alle
CREATE POLICY "Users see own schedules"
  ON public.user_work_schedules FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Masters manage schedules"
  ON public.user_work_schedules FOR ALL
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- updated_at trigger
CREATE TRIGGER trg_user_work_schedules_updated_at
  BEFORE UPDATE ON public.user_work_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helferfunktion: aktuelles Schedule eines Users zu einem Datum
CREATE OR REPLACE FUNCTION public.get_user_work_schedule(_user_id uuid, _on_date date DEFAULT CURRENT_DATE)
RETURNS public.user_work_schedules
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.user_work_schedules
  WHERE user_id = _user_id
    AND valid_from <= _on_date
  ORDER BY valid_from DESC
  LIMIT 1;
$$;

-- Helferfunktion: darf Urlaubstage anderer sehen?
CREATE OR REPLACE FUNCTION public.can_view_others_vacation(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    has_role(_user_id, 'master'::app_role)
    OR has_permission(_user_id, 'calendar.view_others_vacation');
$$;

-- Permission dem Master-System-Rolleneintrag zuweisen (idempotent)
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT id, 'calendar.view_others_vacation'
FROM public.custom_roles
WHERE is_system = true AND base_role = 'master'
ON CONFLICT DO NOTHING;