
-- Add sync tracking columns to user_absences
ALTER TABLE public.user_absences
  ADD COLUMN IF NOT EXISTS sync_source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS outlook_event_id text,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- Create sync settings table for admin configuration
CREATE TABLE IF NOT EXISTS public.sync_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL
);

ALTER TABLE public.sync_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters can manage sync settings"
  ON public.sync_settings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'master'))
  WITH CHECK (has_role(auth.uid(), 'master'));

CREATE POLICY "All authenticated read sync settings"
  ON public.sync_settings FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);
