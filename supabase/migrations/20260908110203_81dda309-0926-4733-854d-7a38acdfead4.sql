-- 1) Typ der Fertigungsfreigabe (erweiterbar, kein Enum)
ALTER TABLE public.production_releases
  ADD COLUMN IF NOT EXISTS release_type text NOT NULL DEFAULT 'nox_aktivitaetsmessung';
CREATE INDEX IF NOT EXISTS idx_production_releases_release_type ON public.production_releases(release_type);

-- 2) Vorgabensätze je Revision
CREATE TABLE public.production_release_spec_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL REFERENCES public.production_releases(id) ON DELETE CASCADE,
  release_type text NOT NULL DEFAULT 'nox_aktivitaetsmessung',
  label text,
  sort_order integer NOT NULL DEFAULT 0,
  source_type text NOT NULL DEFAULT 'pdf',
  page integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_release_spec_sets TO authenticated;
GRANT ALL ON public.production_release_spec_sets TO service_role;
ALTER TABLE public.production_release_spec_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY prss_read ON public.production_release_spec_sets FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role) OR has_permission(auth.uid(), 'production_releases.view'));
CREATE POLICY prss_write ON public.production_release_spec_sets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role) OR has_permission(auth.uid(), 'production_releases.edit') OR has_permission(auth.uid(), 'production_releases.create'))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR has_permission(auth.uid(), 'production_releases.edit') OR has_permission(auth.uid(), 'production_releases.create'));
CREATE INDEX idx_prss_release ON public.production_release_spec_sets(release_id, sort_order);
CREATE TRIGGER trg_prss_updated_at BEFORE UPDATE ON public.production_release_spec_sets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Einzelne Vorgaben je Satz (Wert und Einheit getrennt)
CREATE TABLE public.production_release_spec_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_set_id uuid NOT NULL REFERENCES public.production_release_spec_sets(id) ON DELETE CASCADE,
  parameter_key text NOT NULL,
  parameter_label text,
  value_num numeric,
  value_text text,
  unit text,
  confidence text NOT NULL DEFAULT 'high' CHECK (confidence IN ('high','medium','low')),
  needs_review boolean NOT NULL DEFAULT false,
  confirmed_at timestamptz,
  confirmed_by uuid,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_release_spec_values TO authenticated;
GRANT ALL ON public.production_release_spec_values TO service_role;
ALTER TABLE public.production_release_spec_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY prsv_read ON public.production_release_spec_values FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role) OR has_permission(auth.uid(), 'production_releases.view'));
CREATE POLICY prsv_write ON public.production_release_spec_values FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role) OR has_permission(auth.uid(), 'production_releases.edit') OR has_permission(auth.uid(), 'production_releases.create'))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR has_permission(auth.uid(), 'production_releases.edit') OR has_permission(auth.uid(), 'production_releases.create'));
CREATE INDEX idx_prsv_set ON public.production_release_spec_values(spec_set_id, sort_order);
CREATE TRIGGER trg_prsv_updated_at BEFORE UPDATE ON public.production_release_spec_values
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();