-- Runs only in the disposable local cluster. A-G plus concrete safety/rollback cases.
INSERT INTO user_roles VALUES
 ('10000000-0000-0000-0000-000000000001','auftraggeber'),
 ('10000000-0000-0000-0000-000000000002','durchfuehrer'),
 ('10000000-0000-0000-0000-000000000003','master');
CREATE TRIGGER trg_lock_measurement_orders BEFORE UPDATE OR DELETE ON measurement_orders FOR EACH ROW EXECUTE FUNCTION enforce_order_lock_on_order();
CREATE TRIGGER trg_workflow_measurements AFTER INSERT OR UPDATE OR DELETE ON order_measurements FOR EACH ROW EXECUTE FUNCTION trg_recompute_workflow_from_measurements();
CREATE FUNCTION fixture_order(owner_id uuid DEFAULT '10000000-0000-0000-0000-000000000001') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE o uuid:=gen_random_uuid(); BEGIN
 INSERT INTO measurement_orders(id,created_by,order_number) VALUES(o,owner_id,'DELETE-TEST');
 INSERT INTO order_measurements(id,order_id) VALUES(o,o);
 RETURN o;
END $$;
CREATE FUNCTION assert_blocked(o uuid,expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE blocked boolean:=false; BEGIN
 BEGIN PERFORM cancel_or_delete_order(o); EXCEPTION WHEN OTHERS THEN
  IF position(expected IN SQLERRM)=0 THEN RAISE EXCEPTION 'Wrong refusal: %',SQLERRM; END IF; blocked:=true;
 END;
 IF NOT blocked OR NOT EXISTS(SELECT 1 FROM measurement_orders WHERE id=o) OR NOT EXISTS(SELECT 1 FROM order_measurements WHERE order_id=o) THEN RAISE EXCEPTION 'Expected preserved order and tasks'; END IF;
 IF EXISTS(SELECT 1 FROM activity_log WHERE event_type='order_deleted' AND metadata->>'deleted_order_id'=o::text) THEN RAISE EXCEPTION 'Failed operation left deletion audit'; END IF;
END $$;
SET ROLE authenticated;
SELECT set_config('test.uid','10000000-0000-0000-0000-000000000001',false);
DO $$ DECLARE o uuid:=fixture_order(); BEGIN
 INSERT INTO order_samples(order_id) VALUES(o); INSERT INTO order_analysis_requests(order_id) VALUES(o);
 IF cancel_or_delete_order(o)<>o THEN RAISE EXCEPTION 'A: wrong deleted ID'; END IF;
 IF EXISTS(SELECT 1 FROM measurement_orders WHERE id=o) OR EXISTS(SELECT 1 FROM order_measurements WHERE order_id=o) OR EXISTS(SELECT 1 FROM order_samples WHERE order_id=o) OR EXISTS(SELECT 1 FROM order_analysis_requests WHERE order_id=o) THEN RAISE EXCEPTION 'A: order/task/link not deleted'; END IF;
 IF NOT EXISTS(SELECT 1 FROM activity_log WHERE event_type='order_deleted' AND metadata->>'deleted_order_id'=o::text AND order_id IS NULL AND order_measurement_id IS NULL) THEN RAISE EXCEPTION 'A: missing audit'; END IF;
 RAISE NOTICE 'PASS A: requester creation + physical deletion; provider queries have no task row';
END $$;
DO $$ DECLARE o uuid:=fixture_order(); BEGIN
 UPDATE order_measurements SET assigned_to='10000000-0000-0000-0000-000000000002' WHERE id=o;
 INSERT INTO activity_log(event_type,order_id,order_measurement_id,metadata) VALUES('measurement_claimed',o,o,'{"reason":"assigned"}');
 PERFORM cancel_or_delete_order(o);
 IF EXISTS(SELECT 1 FROM order_measurements WHERE order_id=o OR id=o) THEN RAISE EXCEPTION 'B: assignment survived'; END IF;
 IF NOT EXISTS(SELECT 1 FROM activity_log WHERE event_type='measurement_claimed' AND order_id IS NULL AND order_measurement_id IS NULL AND metadata->>'deleted_order_id'=o::text) THEN RAISE EXCEPTION 'B: history lost'; END IF;
 RAISE NOTICE 'PASS B: assigned but untouched task deleted; assignment history preserved';
END $$;
DO $$ DECLARE o uuid:=fixture_order(); BEGIN
 UPDATE order_measurements SET status='in_progress' WHERE id=o; PERFORM assert_blocked(o,'bereits bearbeitet');
 RAISE NOTICE 'PASS C: started measurement refused'; END $$;
DO $$ DECLARE o uuid:=fixture_order(); BEGIN
 INSERT INTO measurement_results(order_measurement_id,is_official) VALUES(o,true); PERFORM assert_blocked(o,'Messergebnisse');
 IF NOT EXISTS(SELECT 1 FROM measurement_results WHERE order_measurement_id=o AND is_official) THEN RAISE EXCEPTION 'D: result lost'; END IF;
 RAISE NOTICE 'PASS D: official results fully preserved'; END $$;
DO $$ DECLARE o uuid:=fixture_order(); BEGIN
 UPDATE measurement_orders SET workflow_status='abgeschlossen' WHERE id=o; PERFORM assert_blocked(o,'gesperrt');
 RAISE NOTICE 'PASS E: locked order refused'; END $$;
DO $$ DECLARE o uuid:=fixture_order(); BEGIN
 PERFORM set_config('test.uid','10000000-0000-0000-0000-000000000002',true);
 BEGIN PERFORM cancel_or_delete_order(o); RAISE EXCEPTION 'F: unauthorized deletion allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('test.uid','10000000-0000-0000-0000-000000000001',true);
 IF NOT EXISTS(SELECT 1 FROM measurement_orders WHERE id=o) OR NOT EXISTS(SELECT 1 FROM order_measurements WHERE order_id=o) THEN RAISE EXCEPTION 'F: unauthorized attempt removed data'; END IF;
 RAISE NOTICE 'PASS technician cannot delete requester order';
END $$;
-- Independent F with a foreign owner, real row retained and no deletion audit.
DO $$ DECLARE o uuid:=fixture_order('10000000-0000-0000-0000-000000000002'); refused boolean:=false; BEGIN
 BEGIN PERFORM cancel_or_delete_order(o); EXCEPTION WHEN insufficient_privilege THEN refused:=true; END;
 IF NOT refused OR NOT EXISTS(SELECT 1 FROM order_measurements WHERE order_id=o) THEN RAISE EXCEPTION 'F unauthorized: data removed'; END IF;
 RAISE NOTICE 'PASS F: foreign requester rejected server-side'; END $$;
DO $$ DECLARE o uuid:=fixture_order(); i uuid:=gen_random_uuid(); t uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); ps uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); BEGIN
 INSERT INTO order_workflow_instances(id,order_id) VALUES(i,o);
 INSERT INTO order_workflow_tasks(id,instance_id,order_id) VALUES(t,i,o);
 INSERT INTO order_workflow_task_positions(task_id) VALUES(t);
 INSERT INTO order_processes(id,order_id) VALUES(p,o); INSERT INTO order_process_services(id,order_process_id) VALUES(ps,p);
 INSERT INTO order_service_forms(order_process_service_id) VALUES(ps);
 INSERT INTO pilot_plant_blocks(order_id) VALUES(o); INSERT INTO order_drafts(id,source_order_id) VALUES(d,o);
 INSERT INTO order_audit_log(order_id,field_name) VALUES(o,'priority'); INSERT INTO measurement_parameters(order_measurement_id) VALUES(o);
 DELETE FROM workflow_calls WHERE id=o;
 PERFORM cancel_or_delete_order(o);
 IF EXISTS(SELECT 1 FROM order_workflow_tasks WHERE id=t) OR EXISTS(SELECT 1 FROM order_workflow_instances WHERE id=i) OR EXISTS(SELECT 1 FROM order_step_runs WHERE id=s) OR EXISTS(SELECT 1 FROM order_processes WHERE id=p) OR EXISTS(SELECT 1 FROM order_process_services WHERE id=ps) OR EXISTS(SELECT 1 FROM order_step_positions WHERE step_run_id=s) OR EXISTS(SELECT 1 FROM order_workflow_task_positions WHERE task_id=t) OR EXISTS(SELECT 1 FROM order_service_forms WHERE order_process_service_id=ps) OR EXISTS(SELECT 1 FROM pilot_plant_blocks WHERE order_id=o) THEN RAISE EXCEPTION 'G: orphan child'; END IF;
 IF EXISTS(SELECT 1 FROM workflow_calls WHERE id=o) THEN RAISE EXCEPTION 'G: recomputed missing parent'; END IF;
 IF NOT EXISTS(SELECT 1 FROM order_drafts WHERE id=d AND source_order_id IS NULL) THEN RAISE EXCEPTION 'G: draft provenance not detached'; END IF;
 IF NOT EXISTS(SELECT 1 FROM activity_log WHERE event_type='order_deleted' AND metadata->>'deleted_order_id'=o::text AND jsonb_array_length(metadata->'parameters')=1 AND jsonb_array_length(metadata->'order_audit')=1) THEN RAISE EXCEPTION 'G: spec/audit snapshot lost'; END IF;
 RAISE NOTICE 'PASS G: complete workflow cascade, no orphan rows or missing-parent recompute';
END $$;
DO $$ DECLARE o uuid; t text; BEGIN
 FOREACH t IN ARRAY ARRAY['measurement_raw_datasets','measurement_result_corrections','measurement_import_operations'] LOOP
  o:=fixture_order(); EXECUTE format('INSERT INTO %I(order_measurement_id) VALUES($1)',t) USING o; PERFORM assert_blocked(o,'Messergebnisse');
  RAISE NOTICE 'PASS protected %',t;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['work_logs','project_knetung_materials'] LOOP
  o:=fixture_order(); EXECUTE format('INSERT INTO %I(order_measurement_id) VALUES($1)',t) USING o; PERFORM assert_blocked(o,'Arbeitszeiten');
  RAISE NOTICE 'PASS protected %',t;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['documents','order_upload_files'] LOOP
  o:=fixture_order(); EXECUTE format('INSERT INTO %I(%I) VALUES($1)',t,CASE WHEN t='documents' THEN 'order_measurement_id' ELSE 'measurement_id' END) USING o; PERFORM assert_blocked(o,'Dokumente');
  RAISE NOTICE 'PASS protected %',t;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['order_reports','production_releases','production_document_requests'] LOOP
  o:=fixture_order(); EXECUTE format('INSERT INTO %I(order_id) VALUES($1)',t) USING o; PERFORM assert_blocked(o,'Dokumente');
  RAISE NOTICE 'PASS protected %',t;
 END LOOP;
 o:=fixture_order(); INSERT INTO project_time_entries(order_id) VALUES(o); PERFORM assert_blocked(o,'Arbeitszeiten'); RAISE NOTICE 'PASS protected project time';
 o:=fixture_order(); INSERT INTO pilot_plant_produced_samples(order_id) VALUES(o); PERFORM assert_blocked(o,'erzeugte Proben'); RAISE NOTICE 'PASS protected produced sample';
 o:=fixture_order(); INSERT INTO samples(prepared_for_measurement_id) VALUES(o); PERFORM assert_blocked(o,'erzeugte Proben'); RAISE NOTICE 'PASS protected prepared sample';
 o:=fixture_order(); UPDATE order_measurements SET status='completed' WHERE id=o; PERFORM assert_blocked(o,'bereits bearbeitet'); RAISE NOTICE 'PASS completed service';
 o:=fixture_order(); INSERT INTO order_workflow_tasks(order_id,form_response) VALUES(o,'{"value":42}'); PERFORM assert_blocked(o,'bereits bearbeitet'); RAISE NOTICE 'PASS workflow draft response';
 o:=fixture_order(); INSERT INTO order_instances(legacy_order_id) VALUES(o); PERFORM assert_blocked(o,'Prozessauftrag'); RAISE NOTICE 'PASS separate linked workflow refused without orphaning';
 o:=fixture_order(); INSERT INTO pilot_plant_blocks(order_id,status) VALUES(o,'in_progress'); PERFORM assert_blocked(o,'bereits bearbeitet'); RAISE NOTICE 'PASS pilot work started';
 o:=fixture_order(); UPDATE measurement_orders SET order_type='internal' WHERE id=o; PERFORM assert_blocked(o,'Prüfmittelüberwachung'); RAISE NOTICE 'PASS internal isolated';
END $$;
DO $$ DECLARE o uuid:=fixture_order(); BEGIN
 BEGIN DELETE FROM measurement_orders WHERE id=o; RAISE EXCEPTION 'Direct deletion allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE NOTICE 'PASS direct client DELETE denied';
END $$;
DO $$ DECLARE o uuid:=fixture_order('10000000-0000-0000-0000-000000000002'); BEGIN
 PERFORM set_config('test.uid','10000000-0000-0000-0000-000000000003',true);
 PERFORM cancel_or_delete_order(o);
 IF EXISTS(SELECT 1 FROM order_measurements WHERE order_id=o) THEN RAISE EXCEPTION 'Master deletion failed'; END IF;
 RAISE NOTICE 'PASS master deletes foreign untouched order despite SELECT RLS';
END $$;
RESET ROLE;
CREATE FUNCTION fail_deletion_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected late failure'; END $$;
CREATE TRIGGER late_failure AFTER DELETE ON measurement_orders FOR EACH ROW EXECUTE FUNCTION fail_deletion_test();
SET ROLE authenticated;
DO $$ DECLARE o uuid:=fixture_order(); BEGIN
 INSERT INTO activity_log(event_type,order_id,order_measurement_id) VALUES('original',o,o);
 PERFORM assert_blocked(o,'injected late failure');
 IF NOT EXISTS(SELECT 1 FROM activity_log WHERE event_type='original' AND order_id=o AND order_measurement_id=o) THEN RAISE EXCEPTION 'History detach not rolled back'; END IF;
 RAISE NOTICE 'PASS atomic rollback on late cascade failure including original audit links';
END $$;
RESET ROLE;
DROP TRIGGER late_failure ON measurement_orders;
SET ROLE authenticated;
DO $$ DECLARE o uuid:=fixture_order(); BEGIN
 INSERT INTO order_form_versions(order_id,version) VALUES(o,3);
 PERFORM cancel_or_delete_order(o);
 IF EXISTS(SELECT 1 FROM order_form_versions WHERE order_id=o) OR NOT EXISTS(SELECT 1 FROM activity_log WHERE event_type='order_form_bindings_archived' AND metadata->>'deleted_order_id'=o::text AND metadata->'form_versions'->0->>'version'='3') THEN RAISE EXCEPTION 'Form binding not archived'; END IF;
 RAISE NOTICE 'PASS non-FK form bindings archived and removed';
END $$;
DO $$ DECLARE o uuid:=fixture_order(); BEGIN
 INSERT INTO measurement_result_corrections(order_id) VALUES(o); PERFORM assert_blocked(o,'Korrekturhistorie');
 RAISE NOTICE 'PASS order-only correction history protected';
END $$;
DO $$ DECLARE o uuid:=fixture_order(); BEGIN
 INSERT INTO measurement_results(order_measurement_id,is_official) VALUES(o,false);
 PERFORM assert_blocked(o,'Messergebnisse'); RAISE NOTICE 'PASS unofficial saved result protected';
END $$;
DO $$ DECLARE o uuid:=fixture_order('10000000-0000-0000-0000-000000000002'); refused boolean:=false; BEGIN
 PERFORM set_config('test.uid','10000000-0000-0000-0000-000000000002',true);
 BEGIN PERFORM cancel_or_delete_order(o); EXCEPTION WHEN insufficient_privilege THEN refused:=true; END;
 IF NOT refused OR NOT EXISTS(SELECT 1 FROM measurement_orders WHERE id=o) THEN RAISE EXCEPTION 'Technician ownership incorrectly grants deletion'; END IF;
 RAISE NOTICE 'PASS technician-owned order grants no general delete permission';
END $$;
DO $$ DECLARE o uuid:=fixture_order('10000000-0000-0000-0000-000000000002'); refused boolean:=false; BEGIN
 PERFORM set_config('test.uid','10000000-0000-0000-0000-000000000003',true);
 PERFORM set_config('test.external','true',true);
 BEGIN PERFORM cancel_or_delete_order(o); EXCEPTION WHEN insufficient_privilege THEN refused:=true; END;
 IF NOT refused OR NOT EXISTS(SELECT 1 FROM order_measurements WHERE order_id=o) THEN RAISE EXCEPTION 'External isolation bypass'; END IF;
 RAISE NOTICE 'PASS restrictive external ownership even with master role';
END $$;
DO $$ DECLARE o uuid:=fixture_order(); BEGIN
 UPDATE order_measurements SET status='completed' WHERE id=o;
 PERFORM set_config('test.uid','10000000-0000-0000-0000-000000000003',true);
 BEGIN PERFORM cancel_or_delete_order(o); RAISE EXCEPTION 'Master deleted completed service';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%bereits bearbeitet%' THEN RAISE; END IF; END;
 PERFORM set_config('test.uid','10000000-0000-0000-0000-000000000001',true);
 IF NOT EXISTS(SELECT 1 FROM measurement_orders WHERE id=o) OR NOT EXISTS(SELECT 1 FROM order_measurements WHERE id=o AND status='completed') THEN RAISE EXCEPTION 'Master attempt lost data'; END IF;
 RAISE NOTICE 'PASS master cannot delete completed measurement';
END $$;
