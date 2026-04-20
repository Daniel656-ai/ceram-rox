-- Erweitere log_measurement_status_activity um Prioritätsverletzungs-Erkennung
CREATE OR REPLACE FUNCTION public.log_measurement_status_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event_type text;
  v_project_id uuid;
  v_activity_id uuid;
  v_order_creator uuid;
  v_recipient_user_id uuid;
  v_violated_measurements jsonb;
  v_violation_activity_id uuid;
  v_event_subtype text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'in_progress' AND OLD.status = 'open' THEN
    v_event_type := 'measurement_started';
    v_event_subtype := 'started';
  ELSIF NEW.status = 'completed' THEN
    v_event_type := 'measurement_completed';
    v_event_subtype := 'completed';
  ELSE
    RETURN NEW;
  END IF;

  SELECT mo.project_id, mo.created_by
    INTO v_project_id, v_order_creator
  FROM measurement_orders mo
  WHERE mo.id = NEW.order_id;

  -- Hauptaktivität loggen
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

  -- Notifications für completed
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

  -- Prioritätsverletzung erkennen: 
  -- Es existieren noch offene/laufende Messungen mit höherer Priorität,
  -- deren Fälligkeit gleich oder früher liegt (oder kein due_date hat).
  SELECT jsonb_agg(jsonb_build_object(
    'measurement_id', om.id,
    'measurement_number', om.measurement_number,
    'priority', om.priority,
    'due_date', om.due_date,
    'order_id', om.order_id
  ))
  INTO v_violated_measurements
  FROM order_measurements om
  WHERE om.id <> NEW.id
    AND om.status IN ('open', 'in_progress')
    AND om.priority > NEW.priority
    AND (
      NEW.due_date IS NULL
      OR om.due_date IS NULL
      OR om.due_date <= NEW.due_date
    );

  IF v_violated_measurements IS NOT NULL AND jsonb_array_length(v_violated_measurements) > 0 THEN
    INSERT INTO activity_log (event_type, actor_user_id, order_id, order_measurement_id, project_id, service_id, metadata)
    VALUES (
      'priority_violation',
      COALESCE(auth.uid(), NEW.assigned_to),
      NEW.order_id,
      NEW.id,
      v_project_id,
      NEW.service_id,
      jsonb_build_object(
        'measurement_number', NEW.measurement_number,
        'current_priority', NEW.priority,
        'event_subtype', v_event_subtype,
        'violated_measurements', v_violated_measurements
      )
    )
    RETURNING id INTO v_violation_activity_id;

    -- Notifications: Master + Permission notifications.priority_violation
    FOR v_recipient_user_id IN
      SELECT DISTINCT p.user_id
      FROM profiles p
      WHERE p.is_active = true
        AND (
          has_role(p.user_id, 'master'::app_role)
          OR has_permission(p.user_id, 'notifications.priority_violation')
        )
    LOOP
      INSERT INTO notifications (user_id, activity_id)
      VALUES (v_recipient_user_id, v_violation_activity_id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;