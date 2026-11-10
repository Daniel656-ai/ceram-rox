CREATE TABLE public.test_equipment (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(btrim(name))>0), description text,
 service_id uuid REFERENCES public.measurement_services(id) ON DELETE SET NULL,
 responsible_user_id uuid, responsible_name text, interval_days integer NOT NULL CHECK(interval_days>0),
 active boolean NOT NULL DEFAULT true, maintenance boolean NOT NULL DEFAULT false,
 manual_lock boolean NOT NULL DEFAULT false, history_locked boolean NOT NULL DEFAULT false,
 next_due_date date, active_measurement_id uuid UNIQUE REFERENCES public.order_measurements(id) ON DELETE SET NULL,
 created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.test_equipment TO authenticated;
GRANT ALL ON public.test_equipment TO service_role;
ALTER TABLE public.test_equipment ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.test_equipment_checks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), equipment_id uuid NOT NULL REFERENCES public.test_equipment(id) ON DELETE RESTRICT,
 order_measurement_id uuid NOT NULL REFERENCES public.order_measurements(id) ON DELETE RESTRICT,
 status text NOT NULL CHECK(status IN ('bestanden','nicht_bestanden')), performed_at timestamptz NOT NULL,
 performed_by uuid NOT NULL, performed_by_name text NOT NULL, interval_days integer NOT NULL CHECK(interval_days>0),
 service_id uuid NOT NULL REFERENCES public.measurement_services(id) ON DELETE RESTRICT,
 result_summary text NOT NULL CHECK(length(btrim(result_summary))>0), notes text, values jsonb NOT NULL DEFAULT '{}',
 corrects_check_id uuid UNIQUE REFERENCES public.test_equipment_checks(id) ON DELETE RESTRICT,
 root_check_id uuid REFERENCES public.test_equipment_checks(id) ON DELETE RESTRICT,
 version integer NOT NULL DEFAULT 1 CHECK(version>0), correction_reason text, created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((version=1 AND corrects_check_id IS NULL AND root_check_id IS NULL AND correction_reason IS NULL) OR
 (version>1 AND corrects_check_id IS NOT NULL AND root_check_id IS NOT NULL AND length(btrim(correction_reason))>0))
);
GRANT SELECT ON public.test_equipment_checks TO authenticated;
GRANT ALL ON public.test_equipment_checks TO service_role;
ALTER TABLE public.test_equipment_checks ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX equipment_check_initial_measurement ON public.test_equipment_checks(order_measurement_id) WHERE corrects_check_id IS NULL;
CREATE INDEX equipment_checks_timeline ON public.test_equipment_checks(equipment_id,performed_at DESC);
CREATE TABLE public.equipment_rpc_guard(transaction_id bigint PRIMARY KEY, action text NOT NULL, equipment_id uuid NOT NULL);
GRANT ALL ON public.equipment_rpc_guard TO service_role;
ALTER TABLE public.equipment_rpc_guard ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.equipment_rpc_guard FROM anon,authenticated;
CREATE FUNCTION public.equipment_can_manage() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND NOT public.is_external_customer(auth.uid()) AND
 (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'equipment.manage')) $$;
CREATE FUNCTION public.equipment_can_read(_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND NOT public.is_external_customer(auth.uid()) AND
 (public.equipment_can_manage() OR public.has_permission(auth.uid(),'equipment.view') OR EXISTS(
 SELECT 1 FROM public.test_equipment e JOIN public.mdl_service_permissions p ON p.service_id=e.service_id
 WHERE e.id=_id AND p.user_id=auth.uid())) $$;
CREATE POLICY equipment_read ON public.test_equipment FOR SELECT TO authenticated USING(public.equipment_can_read(id));
CREATE POLICY equipment_checks_read ON public.test_equipment_checks FOR SELECT TO authenticated USING(public.equipment_can_read(equipment_id));
CREATE POLICY equipment_external_isolation ON public.test_equipment AS RESTRICTIVE FOR SELECT TO authenticated USING(NOT public.is_external_customer(auth.uid()));
CREATE POLICY equipment_checks_external_isolation ON public.test_equipment_checks AS RESTRICTIVE FOR SELECT TO authenticated USING(NOT public.is_external_customer(auth.uid()));
CREATE FUNCTION public.equipment_guard_begin(_id uuid,_action text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN INSERT INTO public.equipment_rpc_guard VALUES(txid_current(),_action,_id); END $$;
CREATE FUNCTION public.equipment_guard_end() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 DELETE FROM public.equipment_rpc_guard WHERE transaction_id=txid_current() $$;
CREATE FUNCTION public.equipment_audit(_id uuid,_event text,_metadata jsonb) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 INSERT INTO public.activity_log(event_type,actor_user_id,order_id,order_measurement_id,metadata)
 VALUES(_event,auth.uid(),NULL,NULL,_metadata || jsonb_build_object('equipment_id',_id,'actor',auth.uid(),'at',now())) $$;
CREATE FUNCTION public.equipment_recompute(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE last_status text; due date;
BEGIN
 SELECT c.status INTO last_status FROM public.test_equipment_checks c WHERE c.equipment_id=_id AND NOT EXISTS
 (SELECT 1 FROM public.test_equipment_checks n WHERE n.corrects_check_id=c.id)
 ORDER BY c.performed_at DESC,COALESCE(c.root_check_id,c.id) DESC LIMIT 1;
 SELECT (c.performed_at AT TIME ZONE 'Europe/Vienna')::date+c.interval_days INTO due
 FROM public.test_equipment_checks c WHERE c.equipment_id=_id AND c.status='bestanden' AND NOT EXISTS
 (SELECT 1 FROM public.test_equipment_checks n WHERE n.corrects_check_id=c.id)
 ORDER BY c.performed_at DESC,COALESCE(c.root_check_id,c.id) DESC LIMIT 1;
 UPDATE public.test_equipment SET history_locked=COALESCE(last_status='nicht_bestanden',false),next_due_date=due,updated_at=now() WHERE id=_id;
END $$;
CREATE FUNCTION public.equipment_require_qualified(_user uuid,_service uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF _user IS NULL OR public.is_external_customer(_user) OR NOT EXISTS
 (SELECT 1 FROM public.profiles WHERE user_id=_user AND is_active=true) OR NOT EXISTS
 (SELECT 1 FROM public.mdl_service_permissions WHERE user_id=_user AND service_id=_service) OR NOT
 (public.has_role(_user,'durchfuehrer') OR public.has_role(_user,'master')) THEN
 RAISE EXCEPTION 'Aktive Fachkompetenz für diese Messung erforderlich' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION public.equipment_order_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE internal_old boolean:=false; internal_new boolean:=false; allowed boolean;
BEGIN
 IF TG_OP<>'INSERT' THEN internal_old:=OLD.order_type='internal'; END IF;
 IF TG_OP<>'DELETE' THEN internal_new:=NEW.order_type='internal'; END IF;
 IF internal_old OR internal_new THEN
 SELECT EXISTS(SELECT 1 FROM public.equipment_rpc_guard WHERE transaction_id=txid_current()) INTO allowed;
 IF NOT allowed THEN RAISE EXCEPTION 'Interne Prüfaufträge ausschließlich über Prüfmittelüberwachung bearbeiten/abbrechen' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' AND OLD.order_type IS DISTINCT FROM NEW.order_type THEN RAISE EXCEPTION 'Auftragstyp ist unveränderlich'; END IF;
 IF TG_OP<>'DELETE' AND (NEW.sample_id IS NOT NULL OR NEW.project_id IS NOT NULL OR NEW.is_billed) THEN RAISE EXCEPTION 'Interne Prüfung darf keine Kunden-/Projekt-/Probenzuordnung haben'; END IF;
 END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER aaa_equipment_order_guard BEFORE INSERT OR UPDATE OR DELETE ON public.measurement_orders FOR EACH ROW EXECUTE FUNCTION public.equipment_order_guard();
CREATE FUNCTION public.equipment_measurement_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old_internal boolean:=false; new_internal boolean:=false; action_name text;
BEGIN
 IF TG_OP<>'INSERT' THEN SELECT order_type='internal' INTO old_internal FROM public.measurement_orders WHERE id=OLD.order_id; END IF;
 IF TG_OP<>'DELETE' THEN SELECT order_type='internal' INTO new_internal FROM public.measurement_orders WHERE id=NEW.order_id; END IF;
 IF COALESCE(old_internal,false) OR COALESCE(new_internal,false) THEN
 SELECT action INTO action_name FROM public.equipment_rpc_guard WHERE transaction_id=txid_current();
 IF action_name IS NULL THEN RAISE EXCEPTION 'Interne Prüfung nur über Prüfmittelüberwachung' USING ERRCODE='42501'; END IF;
 IF TG_OP='DELETE' AND action_name<>'cancel' THEN RAISE EXCEPTION 'Abbruch-RPC erforderlich'; END IF;
 IF TG_OP='INSERT' AND action_name<>'create' THEN RAISE EXCEPTION 'Prüfauftrag-Erstellung erforderlich'; END IF;
 IF TG_OP='UPDATE' AND (NEW.order_id IS DISTINCT FROM OLD.order_id OR NEW.service_id IS DISTINCT FROM OLD.service_id OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) THEN RAISE EXCEPTION 'Prüfungszuordnung ist unveränderlich'; END IF;
 IF TG_OP<>'DELETE' AND NEW.sample_id IS NOT NULL THEN RAISE EXCEPTION 'Interne Prüfung darf keine Kundenprobe verwenden'; END IF;
 IF TG_OP='INSERT' AND EXISTS(SELECT 1 FROM public.order_measurements WHERE order_id=NEW.order_id) THEN RAISE EXCEPTION 'Genau eine Messung pro internem Prüfauftrag'; END IF;
 END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER aaa_equipment_measurement_guard BEFORE INSERT OR UPDATE OR DELETE ON public.order_measurements FOR EACH ROW EXECUTE FUNCTION public.equipment_measurement_guard();
CREATE FUNCTION public.equipment_result_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE mid uuid; old_mid uuid;
BEGIN
 IF TG_OP<>'DELETE' THEN mid:=NEW.order_measurement_id; END IF;
 IF TG_OP<>'INSERT' THEN old_mid:=OLD.order_measurement_id; END IF;
 IF EXISTS(SELECT 1 FROM public.order_measurements m JOIN public.measurement_orders o ON o.id=m.order_id WHERE m.id IN(mid,old_mid) AND o.order_type='internal') THEN
 RAISE EXCEPTION 'Interne Prüfergebnisse ausschließlich in Prüfhistorie speichern' USING ERRCODE='42501'; END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER equipment_result_guard BEFORE INSERT OR UPDATE OR DELETE ON public.measurement_results FOR EACH ROW EXECUTE FUNCTION public.equipment_result_guard();
CREATE FUNCTION public.equipment_history_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.test_equipment_checks%ROWTYPE; r public.test_equipment_checks%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Prüfhistorie ist unveränderlich'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.equipment_rpc_guard WHERE transaction_id=txid_current() AND equipment_id=NEW.equipment_id AND action IN('record','correct')) THEN RAISE EXCEPTION 'Prüfhistorie nur über geprüfte RPC'; END IF;
 IF NEW.corrects_check_id IS NOT NULL THEN
 SELECT * INTO p FROM public.test_equipment_checks WHERE id=NEW.corrects_check_id;
 SELECT * INTO r FROM public.test_equipment_checks WHERE id=NEW.root_check_id;
 IF p.id IS NULL OR r.id IS NULL OR r.version<>1 OR NEW.root_check_id<>COALESCE(p.root_check_id,p.id) OR NEW.version<>p.version+1 OR NEW.equipment_id<>p.equipment_id OR NEW.order_measurement_id<>p.order_measurement_id OR NEW.performed_at<>r.performed_at OR NEW.performed_by<>r.performed_by OR NEW.interval_days<>r.interval_days OR NEW.service_id<>r.service_id THEN RAISE EXCEPTION 'Ungültige Korrekturkette'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER equipment_history_guard BEFORE INSERT OR UPDATE OR DELETE ON public.test_equipment_checks FOR EACH ROW EXECUTE FUNCTION public.equipment_history_guard();
CREATE FUNCTION public.save_test_equipment(_id uuid,_input jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result_id uuid; e public.test_equipment%ROWTYPE; sid uuid:=NULLIF(_input->>'service_id','')::uuid; interval_value integer:=(_input->>'interval_days')::integer;
BEGIN
 IF NOT public.equipment_can_manage() THEN RAISE EXCEPTION 'Keine Verwaltungsberechtigung' USING ERRCODE='42501'; END IF;
 IF length(btrim(COALESCE(_input->>'name','')))=0 OR interval_value IS NULL OR interval_value<1 THEN RAISE EXCEPTION 'Name und positives Prüfintervall erforderlich'; END IF;
 IF sid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.measurement_services WHERE id=sid AND active AND archived_at IS NULL) THEN RAISE EXCEPTION 'Aktive vorhandene Messung erforderlich'; END IF;
 IF _id IS NULL THEN
 INSERT INTO public.test_equipment(name,description,service_id,responsible_user_id,responsible_name,interval_days,created_by)
 VALUES(btrim(_input->>'name'),_input->>'description',sid,NULLIF(_input->>'responsible_user_id','')::uuid,_input->>'responsible_name',interval_value,auth.uid()) RETURNING id INTO result_id;
 ELSE
 PERFORM pg_advisory_xact_lock(hashtextextended(_id::text,0));
 SELECT * INTO e FROM public.test_equipment WHERE id=_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Prüfmittel nicht gefunden'; END IF;
 IF e.active_measurement_id IS NOT NULL AND (sid IS DISTINCT FROM e.service_id OR interval_value<>e.interval_days) THEN RAISE EXCEPTION 'Messung/Intervall während offener Prüfung nicht ändern'; END IF;
 UPDATE public.test_equipment SET name=btrim(_input->>'name'),description=_input->>'description',service_id=sid,responsible_user_id=NULLIF(_input->>'responsible_user_id','')::uuid,responsible_name=_input->>'responsible_name',interval_days=interval_value,updated_at=now() WHERE id=_id;
 result_id:=_id;
 END IF;
 PERFORM public.equipment_audit(result_id,'equipment_saved',jsonb_build_object('input',_input)); RETURN result_id;
END $$;
CREATE FUNCTION public.set_equipment_state(_equipment_id uuid,_action text,_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.test_equipment%ROWTYPE;
BEGIN
 IF NOT public.equipment_can_manage() THEN RAISE EXCEPTION 'Keine Verwaltungsberechtigung' USING ERRCODE='42501'; END IF;
 IF length(btrim(COALESCE(_reason,'')))=0 THEN RAISE EXCEPTION 'Begründung erforderlich'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_equipment_id::text,0)); SELECT * INTO e FROM public.test_equipment WHERE id=_equipment_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Prüfmittel nicht gefunden'; END IF;
 IF _action NOT IN('deactivate','reactivate','maintenance','release_maintenance','lock','unlock') THEN RAISE EXCEPTION 'Ungültige Aktion'; END IF;
 IF _action='deactivate' AND e.active_measurement_id IS NOT NULL THEN RAISE EXCEPTION 'Offene Prüfung zuerst abbrechen'; END IF;
 IF _action='unlock' AND e.history_locked THEN RAISE EXCEPTION 'Gerätesperre benötigt bestandene Prüfung'; END IF;
 UPDATE public.test_equipment SET active=CASE WHEN _action='deactivate' THEN false WHEN _action='reactivate' THEN true ELSE active END,
 maintenance=CASE WHEN _action='maintenance' THEN true WHEN _action='release_maintenance' THEN false ELSE maintenance END,
 manual_lock=CASE WHEN _action='lock' THEN true WHEN _action='unlock' THEN false ELSE manual_lock END,updated_at=now() WHERE id=_equipment_id;
 PERFORM public.equipment_audit(_equipment_id,'equipment_state_changed',jsonb_build_object('action',_action,'reason',_reason,'previous',to_jsonb(e)));
END $$;
CREATE FUNCTION public.create_equipment_check_order(_equipment_id uuid,_assigned_to uuid,_due_date date DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.test_equipment%ROWTYPE; oid uuid; mid uuid;
BEGIN
 IF auth.uid() IS NULL OR public.is_external_customer(auth.uid()) THEN RAISE EXCEPTION 'Nicht berechtigt' USING ERRCODE='42501'; END IF;
 IF NOT public.equipment_can_manage() AND _assigned_to IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Nur eigene Prüfung anlegen' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_equipment_id::text,0)); SELECT * INTO e FROM public.test_equipment WHERE id=_equipment_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Prüfmittel nicht gefunden'; END IF;
 IF NOT e.active OR e.service_id IS NULL OR e.active_measurement_id IS NOT NULL THEN RAISE EXCEPTION 'Prüfmittel inaktiv, Messung fehlt oder Prüfung bereits offen'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.measurement_services WHERE id=e.service_id AND active AND archived_at IS NULL) THEN RAISE EXCEPTION 'Messung nicht aktiv'; END IF;
 PERFORM public.equipment_require_qualified(_assigned_to,e.service_id);
 PERFORM pg_advisory_xact_lock(hashtextextended('order-number:'||_assigned_to::text,0));
 PERFORM public.equipment_guard_begin(_equipment_id,'create');
 INSERT INTO public.measurement_orders(order_type,created_by,order_kind,due_date,notes,reference_number)
 VALUES('internal',_assigned_to,'legacy',_due_date,'Interne Prüfung: '||e.name,'equipment') RETURNING id INTO oid;
 INSERT INTO public.order_measurements(order_id,service_id,assigned_to,measurement_number,due_date)
 VALUES(oid,e.service_id,_assigned_to,'WILL_BE_OVERWRITTEN',_due_date) RETURNING id INTO mid;
 UPDATE public.test_equipment SET active_measurement_id=mid,updated_at=now() WHERE id=_equipment_id;
 PERFORM public.equipment_audit(_equipment_id,'equipment_check_created',jsonb_build_object('order_id',oid,'measurement_id',mid,'assigned_to',_assigned_to));
 PERFORM public.equipment_guard_end(); RETURN mid;
END $$;
CREATE FUNCTION public.get_equipment_check_context(_equipment_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT public.equipment_can_read(_equipment_id) THEN RAISE EXCEPTION 'Nicht berechtigt' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('measurement_id',m.id,'order_number',o.order_number,'measurement_number',m.measurement_number,'assigned_to',m.assigned_to,'status',m.status,'values',COALESCE(o.shared_form_data->'equipment_values','{}')) INTO result
 FROM public.test_equipment e JOIN public.order_measurements m ON m.id=e.active_measurement_id JOIN public.measurement_orders o ON o.id=m.order_id
 WHERE e.id=_equipment_id AND o.order_type='internal' AND m.service_id=e.service_id; RETURN result;
END $$;
CREATE FUNCTION public.equipment_qualified_users(_equipment_id uuid) RETURNS TABLE(user_id uuid,first_name text,last_name text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.equipment_can_read(_equipment_id) THEN RAISE EXCEPTION 'Nicht berechtigt' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT p.user_id,p.first_name,p.last_name FROM public.profiles p JOIN public.mdl_service_permissions c ON c.user_id=p.user_id JOIN public.test_equipment e ON e.service_id=c.service_id WHERE e.id=_equipment_id AND p.is_active AND NOT public.is_external_customer(p.user_id) AND (public.has_role(p.user_id,'durchfuehrer') OR public.has_role(p.user_id,'master'));
END $$;
CREATE FUNCTION public.equipment_lock_active(_id uuid) RETURNS public.order_measurements LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.test_equipment%ROWTYPE; m public.order_measurements%ROWTYPE; o public.measurement_orders%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(_id::text,0)); SELECT * INTO e FROM public.test_equipment WHERE id=_id FOR UPDATE;
 IF NOT FOUND OR e.active_measurement_id IS NULL THEN RAISE EXCEPTION 'Keine aktive Prüfung'; END IF;
 SELECT * INTO m FROM public.order_measurements WHERE id=e.active_measurement_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Messung nicht gefunden'; END IF;
 SELECT * INTO o FROM public.measurement_orders WHERE id=m.order_id FOR UPDATE;
 SELECT * INTO m FROM public.order_measurements WHERE id=e.active_measurement_id FOR UPDATE;
 IF NOT FOUND OR o.id IS NULL OR o.order_type<>'internal' OR m.service_id IS DISTINCT FROM e.service_id THEN RAISE EXCEPTION 'Ungültige interne Prüfungszuordnung'; END IF;
 IF o.status NOT IN('open','in_progress') OR m.status NOT IN('open','in_progress') OR o.workflow_status='abgeschlossen' OR EXISTS(SELECT 1 FROM public.test_equipment_checks WHERE order_measurement_id=m.id) THEN RAISE EXCEPTION 'Abgeschlossene Prüfung ist geschützt'; END IF;
 RETURN m;
END $$;
CREATE FUNCTION public.save_equipment_check_draft(_equipment_id uuid,_values jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.order_measurements%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR public.is_external_customer(auth.uid()) THEN RAISE EXCEPTION 'Nicht berechtigt' USING ERRCODE='42501'; END IF;
 m:=public.equipment_lock_active(_equipment_id);
 IF m.assigned_to IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Nur zugewiesener Prüfer' USING ERRCODE='42501'; END IF;
 PERFORM public.equipment_require_qualified(auth.uid(),m.service_id);
 IF jsonb_typeof(_values)<>'object' THEN RAISE EXCEPTION 'Ungültige Formularwerte'; END IF;
 PERFORM public.equipment_guard_begin(_equipment_id,'draft');
 UPDATE public.measurement_orders SET shared_form_data=jsonb_set(shared_form_data,'{equipment_values}',_values) WHERE id=m.order_id;
 PERFORM public.equipment_guard_end();
END $$;
CREATE FUNCTION public.start_equipment_check(_equipment_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.order_measurements%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR public.is_external_customer(auth.uid()) THEN RAISE EXCEPTION 'Nicht berechtigt' USING ERRCODE='42501'; END IF;
 m:=public.equipment_lock_active(_equipment_id);
 IF m.assigned_to IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Nur zugewiesener Prüfer' USING ERRCODE='42501'; END IF;
 PERFORM public.equipment_require_qualified(auth.uid(),m.service_id); PERFORM public.equipment_guard_begin(_equipment_id,'start');
 UPDATE public.order_measurements SET status='in_progress' WHERE id=m.id;
 PERFORM public.equipment_audit(_equipment_id,'equipment_check_started',jsonb_build_object('measurement_id',m.id));
 PERFORM public.equipment_guard_end();
END $$;
CREATE FUNCTION public.record_equipment_check(_equipment_id uuid,_status text,_summary text,_notes text,_values jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.order_measurements%ROWTYPE; e public.test_equipment%ROWTYPE; cid uuid; pname text;
BEGIN
 IF auth.uid() IS NULL OR public.is_external_customer(auth.uid()) THEN RAISE EXCEPTION 'Nicht berechtigt' USING ERRCODE='42501'; END IF;
 m:=public.equipment_lock_active(_equipment_id); SELECT * INTO e FROM public.test_equipment WHERE id=_equipment_id;
 IF m.assigned_to IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Nur zugewiesener Prüfer' USING ERRCODE='42501'; END IF;
 PERFORM public.equipment_require_qualified(auth.uid(),m.service_id);
 IF _status NOT IN('bestanden','nicht_bestanden') OR length(btrim(COALESCE(_summary,'')))=0 OR jsonb_typeof(_values)<>'object' THEN RAISE EXCEPTION 'Ergebnis, Zusammenfassung und Formularwerte erforderlich'; END IF;
 SELECT concat_ws(' ',first_name,last_name) INTO pname FROM public.profiles WHERE user_id=auth.uid();
 PERFORM public.equipment_guard_begin(_equipment_id,'record');
 INSERT INTO public.test_equipment_checks(equipment_id,order_measurement_id,status,performed_at,performed_by,performed_by_name,interval_days,service_id,result_summary,notes,values,created_by)
 VALUES(e.id,m.id,_status,clock_timestamp(),auth.uid(),pname,e.interval_days,m.service_id,btrim(_summary),_notes,_values,auth.uid()) RETURNING id INTO cid;
 UPDATE public.order_measurements SET status='completed' WHERE id=m.id;
 UPDATE public.measurement_orders SET status='completed' WHERE id=m.order_id;
 UPDATE public.test_equipment SET active_measurement_id=NULL WHERE id=e.id;
 PERFORM public.equipment_recompute(e.id);
 PERFORM public.equipment_audit(e.id,'equipment_check_recorded',jsonb_build_object('check_id',cid,'measurement_id',m.id,'status',_status));
 PERFORM public.equipment_guard_end(); RETURN cid;
END $$;
CREATE FUNCTION public.correct_equipment_check(_check_id uuid,_status text,_summary text,_notes text,_reason text,_values jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.test_equipment_checks%ROWTYPE; r public.test_equipment_checks%ROWTYPE; cid uuid; eid uuid;
BEGIN
 IF auth.uid() IS NULL OR public.is_external_customer(auth.uid()) THEN RAISE EXCEPTION 'Nicht berechtigt' USING ERRCODE='42501'; END IF;
 SELECT equipment_id INTO eid FROM public.test_equipment_checks WHERE id=_check_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Prüfung nicht gefunden'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(eid::text,0)); PERFORM 1 FROM public.test_equipment WHERE id=eid FOR UPDATE;
 SELECT * INTO p FROM public.test_equipment_checks WHERE id=_check_id FOR UPDATE;
 SELECT * INTO r FROM public.test_equipment_checks WHERE id=COALESCE(p.root_check_id,p.id);
 IF NOT public.has_role(auth.uid(),'master') AND r.performed_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Nur ursprünglicher Prüfer oder Master' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.test_equipment_checks WHERE corrects_check_id=p.id) THEN RAISE EXCEPTION 'Version bereits korrigiert'; END IF;
 IF length(btrim(COALESCE(_reason,'')))=0 OR length(btrim(COALESCE(_summary,'')))=0 OR _status NOT IN('bestanden','nicht_bestanden') OR jsonb_typeof(_values)<>'object' THEN RAISE EXCEPTION 'Ergebnis und Korrekturgrund erforderlich'; END IF;
 PERFORM public.equipment_guard_begin(eid,'correct');
 INSERT INTO public.test_equipment_checks(equipment_id,order_measurement_id,status,performed_at,performed_by,performed_by_name,interval_days,service_id,result_summary,notes,values,corrects_check_id,root_check_id,version,correction_reason,created_by)
 VALUES(eid,p.order_measurement_id,_status,r.performed_at,r.performed_by,r.performed_by_name,r.interval_days,r.service_id,btrim(_summary),_notes,_values,p.id,r.id,p.version+1,btrim(_reason),auth.uid()) RETURNING id INTO cid;
 PERFORM public.equipment_recompute(eid);
 PERFORM public.equipment_audit(eid,'equipment_check_corrected',jsonb_build_object('check_id',cid,'corrects',p.id,'reason',_reason));
 PERFORM public.equipment_guard_end(); RETURN cid;
END $$;
CREATE FUNCTION public.cancel_equipment_check_order(_equipment_id uuid,_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.order_measurements%ROWTYPE; o public.measurement_orders%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR public.is_external_customer(auth.uid()) THEN RAISE EXCEPTION 'Nicht berechtigt' USING ERRCODE='42501'; END IF;
 IF length(btrim(COALESCE(_reason,'')))=0 THEN RAISE EXCEPTION 'Abbruchgrund erforderlich'; END IF;
 m:=public.equipment_lock_active(_equipment_id); SELECT * INTO o FROM public.measurement_orders WHERE id=m.order_id;
 IF NOT public.equipment_can_manage() AND m.assigned_to IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Fremde Prüfung darf nicht abgebrochen werden' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM public.order_measurements WHERE order_id=o.id)<>1 OR EXISTS(SELECT 1 FROM public.measurement_results WHERE order_measurement_id=m.id) THEN RAISE EXCEPTION 'Prüfauftrag ist nicht leer'; END IF;
 PERFORM public.equipment_guard_begin(_equipment_id,'cancel');
 PERFORM public.equipment_audit(_equipment_id,'equipment_check_cancelled',jsonb_build_object('order_id',o.id,'order_number',o.order_number,'measurement_id',m.id,'reason',btrim(_reason)));
 UPDATE public.test_equipment SET active_measurement_id=NULL,updated_at=now() WHERE id=_equipment_id;
 DELETE FROM public.measurement_orders WHERE id=o.id;
 PERFORM public.equipment_guard_end();
END $$;
CREATE OR REPLACE FUNCTION public.tg_bootstrap_workflow() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NEW.order_type='internal' THEN RETURN NEW; END IF; PERFORM public.bootstrap_order_workflow(NEW.id); RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.trg_expand_service_workflow() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.measurement_orders WHERE id=NEW.order_id AND order_type='internal') THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN IF NEW.origin IN('booked','package','workflow') THEN PERFORM public.expand_service_workflow(NEW.id); END IF;
 ELSIF NEW.service_id IS DISTINCT FROM OLD.service_id AND NEW.origin IN('booked','package') THEN PERFORM public.expand_service_workflow(NEW.id); END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.trg_auto_create_order_report() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order_id uuid; v_open_count integer;
BEGIN
 v_order_id:=NEW.order_id;
 IF v_order_id IS NULL OR EXISTS(SELECT 1 FROM public.measurement_orders WHERE id=v_order_id AND order_type='internal') THEN RETURN NEW; END IF;
 SELECT COUNT(*) INTO v_open_count FROM public.order_measurements WHERE order_id=v_order_id AND status<>'completed';
 IF v_open_count=0 THEN INSERT INTO public.order_reports(order_id,auto_generated) VALUES(v_order_id,true) ON CONFLICT(order_id) DO NOTHING; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.trg_recompute_workflow_from_orders() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NEW.order_type='internal' THEN RETURN NEW; END IF; PERFORM public.recompute_order_workflow_status(COALESCE(NEW.id,OLD.id)); RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.trg_recompute_workflow_from_measurements() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF EXISTS(SELECT 1 FROM public.measurement_orders WHERE id=COALESCE(NEW.order_id,OLD.order_id) AND order_type='internal') THEN RETURN COALESCE(NEW,OLD); END IF; PERFORM public.recompute_order_workflow_status(COALESCE(NEW.order_id,OLD.order_id)); RETURN NEW; END $$;
CREATE FUNCTION public.equipment_report_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF EXISTS(SELECT 1 FROM public.measurement_orders WHERE id=NEW.order_id AND order_type='internal') THEN RAISE EXCEPTION 'Kein Kundenbericht für interne Prüfung'; END IF; RETURN NEW; END $$;
CREATE TRIGGER equipment_report_guard BEFORE INSERT OR UPDATE ON public.order_reports FOR EACH ROW EXECUTE FUNCTION public.equipment_report_guard();
CREATE POLICY internal_external_order_isolation ON public.measurement_orders AS RESTRICTIVE FOR SELECT TO authenticated USING(NOT public.is_external_customer(auth.uid()) OR order_type<>'internal');
CREATE POLICY internal_external_measurement_isolation ON public.order_measurements AS RESTRICTIVE FOR SELECT TO authenticated USING(NOT public.is_external_customer(auth.uid()) OR NOT EXISTS(SELECT 1 FROM public.measurement_orders o WHERE o.id=order_id AND o.order_type='internal'));
REVOKE ALL ON FUNCTION public.equipment_can_manage() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.equipment_can_manage() TO authenticated;
REVOKE ALL ON FUNCTION public.equipment_can_read(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.equipment_can_read(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.equipment_guard_begin(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.equipment_guard_end() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.equipment_audit(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.equipment_recompute(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.equipment_require_qualified(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.equipment_order_guard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.equipment_measurement_guard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.equipment_result_guard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.equipment_history_guard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.save_test_equipment(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_test_equipment(uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.set_equipment_state(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_equipment_state(uuid,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.create_equipment_check_order(uuid,uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_equipment_check_order(uuid,uuid,date) TO authenticated;
REVOKE ALL ON FUNCTION public.get_equipment_check_context(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_equipment_check_context(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.equipment_qualified_users(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.equipment_qualified_users(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.equipment_lock_active(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.save_equipment_check_draft(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_equipment_check_draft(uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.start_equipment_check(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_equipment_check(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.record_equipment_check(uuid,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_equipment_check(uuid,text,text,text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.correct_equipment_check(uuid,text,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.correct_equipment_check(uuid,text,text,text,text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.cancel_equipment_check_order(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_equipment_check_order(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.equipment_report_guard() FROM PUBLIC,anon,authenticated;