-- 1) MRS-Nummer gehört zum LOT (idempotent, ändert keine Daten)
ALTER TABLE public.raw_material_batches
  ADD COLUMN IF NOT EXISTS mrs_number text;

-- 2) Löschen von Gebinden: AFTER-DELETE-Protokolleintrag verweist auf das
--    bereits gelöschte Gebinde und verletzt dadurch immer den Fremdschlüssel.
--    Protokollzeilen werden beim Löschen ohnehin mitgelöscht (ON DELETE CASCADE),
--    daher entfällt der Eintrag im DELETE-Fall.
CREATE OR REPLACE FUNCTION public.log_container_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_actor uuid := COALESCE(auth.uid(), NEW.created_by);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO container_audit_log(container_id, action, comment, changed_by)
    VALUES (NEW.id, 'created', 'Gebinde angelegt: '||NEW.container_code, v_actor);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.current_quantity IS DISTINCT FROM NEW.current_quantity THEN
      INSERT INTO container_audit_log(container_id, action, field_name, old_value, new_value, changed_by)
      VALUES (NEW.id, 'updated', 'current_quantity', OLD.current_quantity::text, NEW.current_quantity::text, v_actor);
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO container_audit_log(container_id, action, field_name, old_value, new_value, changed_by)
      VALUES (NEW.id, 'updated', 'status', OLD.status::text, NEW.status::text, v_actor);
    END IF;
    IF OLD.location_id IS DISTINCT FROM NEW.location_id THEN
      INSERT INTO container_audit_log(container_id, action, field_name, old_value, new_value, changed_by)
      VALUES (NEW.id, 'updated', 'location_id', OLD.location_id::text, NEW.location_id::text, v_actor);
      INSERT INTO container_location_history(container_id, from_location_id, to_location_id, from_location_note, to_location_note, changed_by)
      VALUES (NEW.id, OLD.location_id, NEW.location_id, OLD.location_note, NEW.location_note, v_actor);
    END IF;
    IF OLD.location_note IS DISTINCT FROM NEW.location_note AND OLD.location_id IS NOT DISTINCT FROM NEW.location_id THEN
      INSERT INTO container_audit_log(container_id, action, field_name, old_value, new_value, changed_by)
      VALUES (NEW.id, 'updated', 'location_note', OLD.location_note, NEW.location_note, v_actor);
    END IF;
    IF OLD.barcode IS DISTINCT FROM NEW.barcode THEN
      INSERT INTO container_audit_log(container_id, action, field_name, old_value, new_value, changed_by)
      VALUES (NEW.id, 'updated', 'barcode', OLD.barcode, NEW.barcode, v_actor);
    END IF;
    IF OLD.reserved_quantity IS DISTINCT FROM NEW.reserved_quantity THEN
      INSERT INTO container_audit_log(container_id, action, field_name, old_value, new_value, changed_by)
      VALUES (NEW.id, 'updated', 'reserved_quantity', OLD.reserved_quantity::text, NEW.reserved_quantity::text, v_actor);
    END IF;
    IF OLD.notes IS DISTINCT FROM NEW.notes THEN
      INSERT INTO container_audit_log(container_id, action, field_name, old_value, new_value, changed_by)
      VALUES (NEW.id, 'updated', 'notes', OLD.notes, NEW.notes, v_actor);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END $function$;