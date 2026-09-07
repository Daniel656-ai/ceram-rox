-- Revisionsfähigkeit additiv ergänzen
ALTER TABLE public.production_releases
  ADD COLUMN IF NOT EXISTS release_number text,
  ADD COLUMN IF NOT EXISTS revision_number integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revision_date date,
  ADD COLUMN IF NOT EXISTS root_release_id uuid REFERENCES public.production_releases(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS previous_release_id uuid REFERENCES public.production_releases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS import_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS import_source text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS detection_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.production_releases
  DROP CONSTRAINT IF EXISTS production_releases_import_status_check;
ALTER TABLE public.production_releases
  ADD CONSTRAINT production_releases_import_status_check
  CHECK (import_status IN ('none','imported','review_required','reviewed'));

UPDATE public.production_releases SET root_release_id = id WHERE root_release_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_production_releases_root ON public.production_releases(root_release_id);
CREATE INDEX IF NOT EXISTS idx_production_releases_current ON public.production_releases(is_current);
CREATE INDEX IF NOT EXISTS idx_production_releases_release_number ON public.production_releases(release_number);

-- Erkannte Änderungen je Revision
CREATE TABLE IF NOT EXISTS public.production_release_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL REFERENCES public.production_releases(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'field',
  field_key text NOT NULL,
  field_label text,
  old_value text,
  new_value text,
  detection text NOT NULL DEFAULT 'text',
  confidence text NOT NULL DEFAULT 'low',
  status text NOT NULL DEFAULT 'pending',
  page integer,
  note text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_value text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT production_release_changes_detection_check
    CHECK (detection IN ('strikethrough','red','combined','text','unknown')),
  CONSTRAINT production_release_changes_confidence_check
    CHECK (confidence IN ('high','medium','low')),
  CONSTRAINT production_release_changes_status_check
    CHECK (status IN ('auto_applied','pending','accepted','corrected','dismissed'))
);

CREATE INDEX IF NOT EXISTS idx_prc_release ON public.production_release_changes(release_id);
CREATE INDEX IF NOT EXISTS idx_prc_status ON public.production_release_changes(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_release_changes TO authenticated;
GRANT ALL ON public.production_release_changes TO service_role;

ALTER TABLE public.production_release_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prc_select" ON public.production_release_changes;
CREATE POLICY "prc_select" ON public.production_release_changes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'production_releases.view'));

DROP POLICY IF EXISTS "prc_write" ON public.production_release_changes;
CREATE POLICY "prc_write" ON public.production_release_changes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'production_releases.edit'))
  WITH CHECK (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'production_releases.edit'));