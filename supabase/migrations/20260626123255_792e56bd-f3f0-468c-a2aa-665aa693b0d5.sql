
ALTER TABLE public.project_time_entries
  ADD COLUMN IF NOT EXISTS entry_type text NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS meeting_group_id uuid;

ALTER TABLE public.project_time_entries
  DROP CONSTRAINT IF EXISTS project_time_entries_entry_type_check;
ALTER TABLE public.project_time_entries
  ADD CONSTRAINT project_time_entries_entry_type_check CHECK (entry_type IN ('individual','meeting'));

CREATE INDEX IF NOT EXISTS idx_project_time_entries_meeting_group ON public.project_time_entries(meeting_group_id);
