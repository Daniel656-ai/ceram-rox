
-- ============= activity_log =============
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  actor_user_id uuid,
  order_id uuid REFERENCES public.measurement_orders(id) ON DELETE CASCADE,
  order_measurement_id uuid REFERENCES public.order_measurements(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  service_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_created_at ON public.activity_log(created_at DESC);
CREATE INDEX idx_activity_log_order_id ON public.activity_log(order_id);
CREATE INDEX idx_activity_log_project_id ON public.activity_log(project_id);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see relevant activity"
ON public.activity_log
FOR SELECT
USING (
  has_role(auth.uid(), 'master'::app_role)
  OR has_permission(auth.uid(), 'activity_log.view_all')
  OR (order_id IS NOT NULL AND is_order_creator(auth.uid(), order_id))
  OR (order_id IS NOT NULL AND is_assigned_to_order(auth.uid(), order_id))
  OR (project_id IS NOT NULL AND is_project_member(auth.uid(), project_id))
  OR (actor_user_id = auth.uid())
);

CREATE POLICY "System inserts activity"
ON public.activity_log
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- ============= notifications =============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_id uuid NOT NULL REFERENCES public.activity_log(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications"
ON public.notifications
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications"
ON public.notifications
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "System inserts notifications"
ON public.notifications
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- ============= Trigger: Status-Änderung loggen + benachrichtigen =============
CREATE OR REPLACE FUNCTION public.log_measurement_status_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type text;
  v_project_id uuid;
  v_activity_id uuid;
  v_order_creator uuid;
  v_recipient_user_id uuid;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'in_progress' AND OLD.status = 'open' THEN
    v_event_type := 'measurement_started';
  ELSIF NEW.status = 'completed' THEN
    v_event_type := 'measurement_completed';
  ELSE
    RETURN NEW;
  END IF;

  SELECT mo.project_id, mo.created_by
    INTO v_project_id, v_order_creator
  FROM measurement_orders mo
  WHERE mo.id = NEW.order_id;

  INSERT INTO activity_log (event_type, actor_user_id, order_id, order_measurement_id, project_id, service_id, metadata)
  VALUES (
    v_event_type,
    COALESCE(auth.uid(), NEW.assigned_to),
    NEW.order_id,
    NEW.id,
    v_project_id,
    NEW.service_id,
    jsonb_build_object('measurement_number', NEW.measurement_number, 'old_status', OLD.status, 'new_status', NEW.status)
  )
  RETURNING id INTO v_activity_id;

  -- Benachrichtigungen nur bei completed
  IF v_event_type = 'measurement_completed' THEN
    FOR v_recipient_user_id IN
      SELECT DISTINCT p.user_id
      FROM profiles p
      WHERE p.is_active = true
        AND (
          has_role(p.user_id, 'master'::app_role)
          OR (
            has_permission(p.user_id, 'notifications.measurement_completed')
            AND (
              p.user_id = v_order_creator
              OR p.user_id = NEW.assigned_to
              OR (v_project_id IS NOT NULL AND (
                has_project_role(p.user_id, v_project_id, 'owner'::project_role)
                OR has_project_role(p.user_id, v_project_id, 'leader'::project_role)
              ))
            )
          )
        )
    LOOP
      INSERT INTO notifications (user_id, activity_id)
      VALUES (v_recipient_user_id, v_activity_id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_measurement_status_activity
AFTER UPDATE OF status ON public.order_measurements
FOR EACH ROW
EXECUTE FUNCTION public.log_measurement_status_activity();

-- ============= Trigger: Prio + Ranking aus measurement_orders ins activity_log =============
CREATE OR REPLACE FUNCTION public.log_order_priority_ranking_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO activity_log (event_type, actor_user_id, order_id, project_id, metadata)
    VALUES (
      'priority_changed',
      COALESCE(auth.uid(), NEW.created_by),
      NEW.id,
      NEW.project_id,
      jsonb_build_object('order_number', NEW.order_number, 'old_value', OLD.priority::text, 'new_value', NEW.priority::text)
    );
  END IF;

  IF OLD.ranking IS DISTINCT FROM NEW.ranking THEN
    INSERT INTO activity_log (event_type, actor_user_id, order_id, project_id, metadata)
    VALUES (
      'ranking_changed',
      COALESCE(auth.uid(), NEW.created_by),
      NEW.id,
      NEW.project_id,
      jsonb_build_object('order_number', NEW.order_number, 'old_value', OLD.ranking::text, 'new_value', NEW.ranking::text)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_order_priority_ranking_activity
AFTER UPDATE OF priority, ranking ON public.measurement_orders
FOR EACH ROW
EXECUTE FUNCTION public.log_order_priority_ranking_activity();

-- ============= Realtime aktivieren =============
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.activity_log REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
