
-- Arbeitsplaetze
CREATE TABLE public.workstations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  responsible_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workstations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read workstations"
  ON public.workstations FOR SELECT USING (true);

CREATE POLICY "Masters can manage workstations"
  ON public.workstations FOR ALL
  USING (has_role(auth.uid(), 'master'))
  WITH CHECK (has_role(auth.uid(), 'master'));

-- Aufgaben pro Arbeitsplatz
CREATE TYPE public.task_status AS ENUM ('open', 'in_progress', 'completed');

CREATE TABLE public.workstation_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_id uuid NOT NULL REFERENCES public.workstations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to uuid,
  due_date date,
  hourly_rate numeric NOT NULL DEFAULT 0,
  status task_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workstation_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read tasks"
  ON public.workstation_tasks FOR SELECT USING (true);

CREATE POLICY "Masters can manage tasks"
  ON public.workstation_tasks FOR ALL
  USING (has_role(auth.uid(), 'master'))
  WITH CHECK (has_role(auth.uid(), 'master'));

-- updated_at Trigger
CREATE TRIGGER update_workstations_updated_at
  BEFORE UPDATE ON public.workstations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workstation_tasks_updated_at
  BEFORE UPDATE ON public.workstation_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
