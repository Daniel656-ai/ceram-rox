-- Legacy-linked instances and form-version bindings have no parent FK in the existing schema.
-- Handle them before parent deletion; never leave a second active workflow behind.
CREATE OR REPLACE FUNCTION public.guard_order_delete_dependents()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _instances uuid[]; _snapshot jsonb;
BEGIN
  PERFORM 1 FROM public.order_instances WHERE legacy_order_id=OLD.id ORDER BY id FOR UPDATE;
  SELECT coalesce(array_agg(id),ARRAY[]::uuid[]) INTO _instances FROM public.order_instances WHERE legacy_order_id=OLD.id;
  IF EXISTS(SELECT 1 FROM public.measurement_result_corrections WHERE order_id=OLD.id) THEN
    RAISE EXCEPTION 'Auftrag enthält Korrekturhistorie und darf nicht gelöscht werden.';
  END IF;
  -- Linked modern workflows are separate aggregates: refuse deletion rather than infer their state.
  IF cardinality(_instances)>0 THEN
    RAISE EXCEPTION 'Auftrag ist mit einem weiteren Prozessauftrag verknüpft und darf nicht gelöscht werden. Bitte zuerst die Prozessverknüpfung fachlich prüfen.';
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(v)),'[]'::jsonb) INTO _snapshot FROM public.order_form_versions v WHERE order_id=OLD.id;
  IF jsonb_array_length(_snapshot)>0 THEN
    INSERT INTO public.activity_log(event_type,actor_user_id,project_id,metadata)
      VALUES('order_form_bindings_archived',auth.uid(),OLD.project_id,
        jsonb_build_object('deleted_order_id',OLD.id,'order_number',OLD.order_number,'form_versions',_snapshot));
    DELETE FROM public.order_form_versions WHERE order_id=OLD.id;
  END IF;
  -- form_value_history and historian retain their original UUIDs (no parent FK).
  RETURN OLD;
END $$;
CREATE TRIGGER trg_guard_order_delete_dependents BEFORE DELETE ON public.measurement_orders
FOR EACH ROW EXECUTE FUNCTION public.guard_order_delete_dependents();