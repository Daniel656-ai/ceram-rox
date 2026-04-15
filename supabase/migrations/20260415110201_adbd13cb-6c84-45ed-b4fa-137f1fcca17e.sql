
-- Create enums
CREATE TYPE public.project_role AS ENUM ('owner', 'leader', 'member');
CREATE TYPE public.project_status AS ENUM ('active', 'completed');
CREATE TYPE public.traffic_light_status AS ENUM ('green', 'yellow', 'red');
CREATE TYPE public.milestone_status AS ENUM ('planned', 'in_progress', 'completed');

-- Add new columns to projects
ALTER TABLE public.projects
  ADD COLUMN start_date date,
  ADD COLUMN end_date date,
  ADD COLUMN project_status public.project_status NOT NULL DEFAULT 'active',
  ADD COLUMN traffic_light public.traffic_light_status NOT NULL DEFAULT 'green';

-- Create project_members table
CREATE TABLE public.project_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.project_role NOT NULL DEFAULT 'member',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Create project_milestones table
CREATE TABLE public.project_milestones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_date date,
  end_date date,
  status public.milestone_status NOT NULL DEFAULT 'planned',
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_project_members_project ON public.project_members(project_id);
CREATE INDEX idx_project_members_user ON public.project_members(user_id);
CREATE INDEX idx_project_milestones_project ON public.project_milestones(project_id);

-- Helper function: check if user is a member of a project
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE user_id = _user_id AND project_id = _project_id
  )
$$;

-- Helper function: check if user has a specific project role
CREATE OR REPLACE FUNCTION public.has_project_role(_user_id uuid, _project_id uuid, _role project_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE user_id = _user_id AND project_id = _project_id AND role = _role
  )
$$;

-- Enable RLS on new tables
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;

-- RLS for project_members
CREATE POLICY "Members and masters see project members"
  ON public.project_members FOR SELECT
  USING (
    has_role(auth.uid(), 'master'::app_role)
    OR is_project_member(auth.uid(), project_id)
  );

CREATE POLICY "Owner leader master manage members"
  ON public.project_members FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'master'::app_role)
    OR has_project_role(auth.uid(), project_id, 'owner')
    OR has_project_role(auth.uid(), project_id, 'leader')
  );

CREATE POLICY "Owner leader master update members"
  ON public.project_members FOR UPDATE
  USING (
    has_role(auth.uid(), 'master'::app_role)
    OR has_project_role(auth.uid(), project_id, 'owner')
    OR has_project_role(auth.uid(), project_id, 'leader')
  );

CREATE POLICY "Owner leader master delete members"
  ON public.project_members FOR DELETE
  USING (
    has_role(auth.uid(), 'master'::app_role)
    OR has_project_role(auth.uid(), project_id, 'owner')
    OR has_project_role(auth.uid(), project_id, 'leader')
  );

-- RLS for project_milestones
CREATE POLICY "Members and masters see milestones"
  ON public.project_milestones FOR SELECT
  USING (
    has_role(auth.uid(), 'master'::app_role)
    OR is_project_member(auth.uid(), project_id)
  );

CREATE POLICY "Leader and master manage milestones"
  ON public.project_milestones FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'master'::app_role)
    OR has_project_role(auth.uid(), project_id, 'leader')
  );

CREATE POLICY "Leader and master update milestones"
  ON public.project_milestones FOR UPDATE
  USING (
    has_role(auth.uid(), 'master'::app_role)
    OR has_project_role(auth.uid(), project_id, 'leader')
  );

CREATE POLICY "Leader and master delete milestones"
  ON public.project_milestones FOR DELETE
  USING (
    has_role(auth.uid(), 'master'::app_role)
    OR has_project_role(auth.uid(), project_id, 'leader')
  );

-- Update timestamp trigger for milestones
CREATE TRIGGER update_project_milestones_updated_at
  BEFORE UPDATE ON public.project_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update projects RLS: Replace the old SELECT policy with member-based visibility
DROP POLICY IF EXISTS "All authenticated users can view projects" ON public.projects;

CREATE POLICY "Members and masters can view projects"
  ON public.projects FOR SELECT
  USING (
    has_role(auth.uid(), 'master'::app_role)
    OR is_project_member(auth.uid(), id)
  );

-- Update projects UPDATE policy to include project leaders
DROP POLICY IF EXISTS "Auftraggeber update own projects" ON public.projects;

CREATE POLICY "Owner leader master update projects"
  ON public.projects FOR UPDATE
  USING (
    has_role(auth.uid(), 'master'::app_role)
    OR has_project_role(auth.uid(), id, 'owner')
    OR has_project_role(auth.uid(), id, 'leader')
  );

-- Update projects DELETE policy
DROP POLICY IF EXISTS "Creators and masters can delete projects" ON public.projects;

CREATE POLICY "Owner and master delete projects"
  ON public.projects FOR DELETE
  USING (
    has_role(auth.uid(), 'master'::app_role)
    OR has_project_role(auth.uid(), id, 'owner')
  );
