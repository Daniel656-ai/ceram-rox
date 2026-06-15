
-- =========================
-- Recipients table
-- =========================
CREATE TABLE public.hazard_notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hazard_notification_recipients TO authenticated;
GRANT ALL ON public.hazard_notification_recipients TO service_role;

ALTER TABLE public.hazard_notification_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage hazard recipients"
  ON public.hazard_notification_recipients
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'master'::app_role) OR public.has_permission(auth.uid(), 'hazard_notifications.manage'))
  WITH CHECK (public.has_role(auth.uid(), 'master'::app_role) OR public.has_permission(auth.uid(), 'hazard_notifications.manage'));

CREATE POLICY "Recipients can see their own row"
  ON public.hazard_notification_recipients
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- =========================
-- Log table
-- =========================
CREATE TABLE public.hazard_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('hazard_material_created','hazard_material_updated')),
  triggered_by uuid,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  recipient_user_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  material_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  activity_id uuid REFERENCES public.activity_log(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'dashboard'
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hazard_notification_log TO authenticated;
GRANT ALL ON public.hazard_notification_log TO service_role;

ALTER TABLE public.hazard_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view hazard log"
  ON public.hazard_notification_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'master'::app_role) OR public.has_permission(auth.uid(), 'hazard_notifications.manage'));

CREATE POLICY "System inserts hazard log"
  ON public.hazard_notification_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_hazard_log_material ON public.hazard_notification_log(raw_material_id);
CREATE INDEX idx_hazard_log_triggered_at ON public.hazard_notification_log(triggered_at DESC);

-- =========================
-- Trigger function
-- =========================
CREATE OR REPLACE FUNCTION public.notify_hazard_material_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type text;
  v_activity_id uuid;
  v_recipient_ids uuid[];
  v_recipient_user_id uuid;
  v_actor uuid;
  v_snapshot jsonb;
BEGIN
  -- Only act if the resulting row is hazardous
  IF NEW.is_hazardous IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_event_type := 'hazard_material_created';
  ELSE
    -- For updates: only when something user-relevant actually changed
    IF OLD.is_hazardous = NEW.is_hazardous
       AND OLD.material_name IS NOT DISTINCT FROM NEW.material_name
       AND OLD.material_number IS NOT DISTINCT FROM NEW.material_number
       AND OLD.supplier IS NOT DISTINCT FROM NEW.supplier
       AND OLD.description IS NOT DISTINCT FROM NEW.description
       AND OLD.hazard_categories IS NOT DISTINCT FROM NEW.hazard_categories
       AND OLD.unit IS NOT DISTINCT FROM NEW.unit
    THEN
      RETURN NEW;
    END IF;
    v_event_type := 'hazard_material_updated';
  END IF;

  v_actor := COALESCE(auth.uid(), NEW.created_by);

  v_snapshot := jsonb_build_object(
    'raw_material_id', NEW.id,
    'material_name', NEW.material_name,
    'material_number', NEW.material_number,
    'supplier', NEW.supplier,
    'description', NEW.description,
    'unit', NEW.unit,
    'hazard_categories', NEW.hazard_categories,
    'is_hazardous', NEW.is_hazardous,
    'created_by', NEW.created_by,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at
  );

  -- Create one activity_log entry (for dashboard feed)
  INSERT INTO public.activity_log (event_type, actor_user_id, metadata)
  VALUES (
    v_event_type,
    v_actor,
    v_snapshot || jsonb_build_object('event_time', now())
  )
  RETURNING id INTO v_activity_id;

  -- Collect current recipients
  SELECT COALESCE(array_agg(user_id), ARRAY[]::uuid[])
    INTO v_recipient_ids
  FROM public.hazard_notification_recipients;

  -- Dashboard notification per recipient
  IF array_length(v_recipient_ids, 1) IS NOT NULL THEN
    FOREACH v_recipient_user_id IN ARRAY v_recipient_ids LOOP
      INSERT INTO public.notifications (user_id, activity_id)
      VALUES (v_recipient_user_id, v_activity_id);
    END LOOP;
  END IF;

  -- Audit log
  INSERT INTO public.hazard_notification_log
    (raw_material_id, event_type, triggered_by, recipient_user_ids, material_snapshot, activity_id, channel)
  VALUES
    (NEW.id, v_event_type, v_actor, v_recipient_ids, v_snapshot, v_activity_id, 'dashboard');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_hazard_material_insert ON public.raw_materials;
CREATE TRIGGER trg_notify_hazard_material_insert
  AFTER INSERT ON public.raw_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_hazard_material_change();

DROP TRIGGER IF EXISTS trg_notify_hazard_material_update ON public.raw_materials;
CREATE TRIGGER trg_notify_hazard_material_update
  AFTER UPDATE ON public.raw_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_hazard_material_change();
