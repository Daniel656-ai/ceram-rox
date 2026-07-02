
-- Audit-Trail: wer hat den Eintrag tatsächlich erstellt/bearbeitet (auch bei stellvertretender Erfassung durch PMO)
ALTER TABLE public.project_weekly_reviews
  ADD COLUMN IF NOT EXISTS created_by_actual uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS edited_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- Trigger: created_by_actual auf auth.uid() setzen; edited_by/edited_at bei UPDATE
CREATE OR REPLACE FUNCTION public.set_weekly_review_actor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by_actual := COALESCE(NEW.created_by_actual, auth.uid());
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.edited_by := auth.uid();
    NEW.edited_at := now();
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_weekly_review_actor_ins ON public.project_weekly_reviews;
CREATE TRIGGER trg_weekly_review_actor_ins
  BEFORE INSERT ON public.project_weekly_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_weekly_review_actor();

DROP TRIGGER IF EXISTS trg_weekly_review_actor_upd ON public.project_weekly_reviews;
CREATE TRIGGER trg_weekly_review_actor_upd
  BEFORE UPDATE ON public.project_weekly_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_weekly_review_actor();

-- INSERT-Policy erweitern: PMO (weekly_reviews.manage_all) darf stellvertretend anlegen
DROP POLICY IF EXISTS weekly_reviews_insert ON public.project_weekly_reviews;
CREATE POLICY weekly_reviews_insert ON public.project_weekly_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      -- Selbst erstellter Review: nur wenn tatsächlich Projektmitglied
      author_user_id = auth.uid()
      AND (
        is_project_member(auth.uid(), project_id)
        OR has_role(auth.uid(), 'master'::app_role)
      )
    )
    OR
    (
      -- Stellvertretende Erfassung: PMO / weekly_reviews.manage_all
      has_permission(auth.uid(), 'weekly_reviews.manage_all')
      AND is_project_member(author_user_id, project_id)
    )
    OR has_role(auth.uid(), 'master'::app_role)
  );
