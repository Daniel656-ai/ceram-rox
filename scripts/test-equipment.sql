-- Integration test: run ONLY against an isolated disposable database with ROX schema.
-- All fixture changes are rolled back. Never run against the productive Web/company database.
BEGIN;
INSERT INTO public.profiles(user_id,first_name,last_name,short_code,is_active) VALUES
('10000000-0000-0000-0000-000000000001','Admin','Test','ADM',true),
('10000000-0000-0000-0000-000000000002','Qualified','Test','QUA',true),
('10000000-0000-0000-0000-000000000003','Other','Test','OTH',true);
INSERT INTO public.user_roles(user_id,role) VALUES
('10000000-0000-0000-0000-000000000001','master'),
('10000000-0000-0000-0000-000000000002','durchfuehrer'),
('10000000-0000-0000-0000-000000000003','durchfuehrer');
INSERT INTO public.measurement_services(id,service_name,category) VALUES('20000000-0000-0000-0000-000000000001','Test service','labor');
INSERT INTO public.mdl_service_permissions(user_id,service_id) VALUES('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001');
SELECT set_config('test.uid','10000000-0000-0000-0000-000000000001',true);
DO $$
DECLARE e uuid; mid uuid; c uuid; c2 uuid; c3 uuid; due date; failed boolean; cnt int;
BEGIN
 e:=public.save_test_equipment(NULL,'{"name":"Integration device","interval_days":30,"service_id":"20000000-0000-0000-0000-000000000001"}');
 failed:=false; BEGIN PERFORM public.create_equipment_check_order(e,auth.uid(),NULL); EXCEPTION WHEN insufficient_privilege THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Admin without competence accepted'; END IF; RAISE NOTICE 'PASS admin without competence rejected';
 mid:=public.create_equipment_check_order(e,'10000000-0000-0000-0000-000000000002',NULL);
 failed:=false; BEGIN PERFORM public.create_equipment_check_order(e,'10000000-0000-0000-0000-000000000002',NULL); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Duplicate open check accepted'; END IF; RAISE NOTICE 'PASS duplicate open check rejected';
 failed:=false; BEGIN DELETE FROM public.measurement_orders WHERE id=(SELECT order_id FROM public.order_measurements WHERE id=mid); EXCEPTION WHEN insufficient_privilege THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Generic deletion accepted'; END IF; RAISE NOTICE 'PASS generic deletion rejected';
 PERFORM set_config('test.uid','10000000-0000-0000-0000-000000000003',true);
 failed:=false; BEGIN PERFORM public.cancel_equipment_check_order(e,'Other user'); EXCEPTION WHEN insufficient_privilege THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Foreign cancellation accepted'; END IF; RAISE NOTICE 'PASS foreign cancellation rejected';
 PERFORM set_config('test.uid','10000000-0000-0000-0000-000000000002',true);
 PERFORM public.start_equipment_check(e);
 c:=public.record_equipment_check(e,'bestanden','Passed','notes','{"value":5}');
 SELECT next_due_date INTO due FROM public.test_equipment WHERE id=e;
 IF due<>(now() AT TIME ZONE 'Europe/Vienna')::date+30 THEN RAISE EXCEPTION 'Wrong due date'; END IF;
 IF (SELECT status FROM public.order_measurements WHERE id=mid)<>'completed' THEN RAISE EXCEPTION 'Not completed'; END IF;
 RAISE NOTICE 'PASS create/start/complete and Vienna due date';
 failed:=false; BEGIN UPDATE public.test_equipment_checks SET result_summary='altered' WHERE id=c; EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'History update accepted'; END IF; RAISE NOTICE 'PASS append-only history';
 failed:=false; BEGIN DELETE FROM public.order_measurements WHERE id=mid; EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Completed deletion accepted'; END IF; RAISE NOTICE 'PASS completed deletion protected';
 mid:=public.create_equipment_check_order(e,auth.uid(),NULL);
 PERFORM public.cancel_equipment_check_order(e,'Assigned cancellation',mid);
 IF EXISTS(SELECT 1 FROM public.order_measurements WHERE id=mid) OR (SELECT next_due_date FROM public.test_equipment WHERE id=e)<>due THEN RAISE EXCEPTION 'Cancellation changed timer or left measurement'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.activity_log WHERE event_type='equipment_check_cancelled' AND metadata->>'measurement_id'=mid::text AND order_id IS NULL AND order_measurement_id IS NULL) THEN RAISE EXCEPTION 'Cancellation audit missing'; END IF;
 RAISE NOTICE 'PASS assigned cancellation preserves timer and audit';
 failed:=false; BEGIN PERFORM public.save_equipment_check_draft(e,'{}',mid); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Stale check identity accepted'; END IF; RAISE NOTICE 'PASS stale check identity rejected';
 mid:=public.create_equipment_check_order(e,auth.uid(),NULL);
 DELETE FROM public.mdl_service_permissions WHERE user_id=auth.uid();
 failed:=false; BEGIN PERFORM public.record_equipment_check(e,'bestanden','Passed','','{}'); EXCEPTION WHEN insufficient_privilege THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Revoked competence accepted'; END IF; RAISE NOTICE 'PASS competence rechecked on completion';
 INSERT INTO public.mdl_service_permissions VALUES(auth.uid(),'20000000-0000-0000-0000-000000000001');
 c2:=public.record_equipment_check(e,'nicht_bestanden','Failed','','{}');
 IF NOT (SELECT history_locked FROM public.test_equipment WHERE id=e) THEN RAISE EXCEPTION 'Failure not locked'; END IF;
 c3:=public.correct_equipment_check(c,'nicht_bestanden','Old corrected','','Reason','{}');
 IF NOT (SELECT history_locked FROM public.test_equipment WHERE id=e) THEN RAISE EXCEPTION 'Old correction overwrote newer failure'; END IF; RAISE NOTICE 'PASS older correction preserves newer failure';
 failed:=false; BEGIN PERFORM public.correct_equipment_check(c,'bestanden','Branch','','Reason','{}'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Correction branch accepted'; END IF; RAISE NOTICE 'PASS correction branching rejected';
 PERFORM set_config('test.uid','10000000-0000-0000-0000-000000000003',true);
 failed:=false; BEGIN PERFORM public.correct_equipment_check(c3,'bestanden','Foreign','','Reason','{}'); EXCEPTION WHEN insufficient_privilege THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Foreign correction accepted'; END IF; RAISE NOTICE 'PASS foreign correction rejected';
 PERFORM set_config('test.uid','10000000-0000-0000-0000-000000000001',true);
 PERFORM public.set_equipment_state(e,'maintenance','Maintenance');
 PERFORM set_config('test.uid','10000000-0000-0000-0000-000000000002',true);
 mid:=public.create_equipment_check_order(e,auth.uid(),NULL); PERFORM public.record_equipment_check(e,'bestanden','Passed','','{}');
 IF NOT (SELECT maintenance FROM public.test_equipment WHERE id=e) OR (SELECT history_locked FROM public.test_equipment WHERE id=e) THEN RAISE EXCEPTION 'Wrong maintenance/failure state'; END IF;
 PERFORM set_config('test.uid','10000000-0000-0000-0000-000000000001',true);
 PERFORM public.set_equipment_state(e,'release_maintenance','Explicit release');
 IF (SELECT maintenance FROM public.test_equipment WHERE id=e) THEN RAISE EXCEPTION 'Maintenance not released'; END IF; RAISE NOTICE 'PASS passed check keeps maintenance until explicit release';
 IF EXISTS(SELECT 1 FROM public.measurement_results r JOIN public.order_measurements m ON m.id=r.order_measurement_id JOIN public.measurement_orders o ON o.id=m.order_id WHERE o.order_type='internal') THEN RAISE EXCEPTION 'Internal customer results'; END IF;
 RAISE NOTICE 'PASS no customer result records';
END $$;
-- Exercise actual app role: direct writes denied even when permissive policy exists.
GRANT USAGE ON SCHEMA public,auth TO authenticated;
GRANT SELECT ON public.profiles,public.user_roles,public.role_permissions,public.mdl_service_permissions TO authenticated;
ALTER TABLE public.measurement_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_measurements ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.measurement_orders,public.order_measurements TO authenticated;
CREATE POLICY fixture_read ON public.measurement_orders FOR SELECT TO authenticated USING(true);
CREATE POLICY fixture_read ON public.order_measurements FOR SELECT TO authenticated USING(true);
INSERT INTO public.role_permissions VALUES('10000000-0000-0000-0000-000000000003','external'),('10000000-0000-0000-0000-000000000003','equipment.view');
SELECT set_config('test.uid','10000000-0000-0000-0000-000000000003',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE failed boolean:=false; BEGIN
 IF EXISTS(SELECT 1 FROM public.measurement_orders WHERE order_type='internal') OR EXISTS(SELECT 1 FROM public.order_measurements) OR EXISTS(SELECT 1 FROM public.test_equipment) OR EXISTS(SELECT 1 FROM public.test_equipment_checks) THEN RAISE EXCEPTION 'External isolation bypassed'; END IF;
 RAISE NOTICE 'PASS external isolation despite permissive reads';
 BEGIN INSERT INTO public.test_equipment(name,interval_days) VALUES('Forbidden',30); EXCEPTION WHEN insufficient_privilege THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Direct equipment write accepted'; END IF;
 IF has_function_privilege('authenticated','public.record_equipment_check(uuid,text,text,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Unsafe RPC executable'; END IF;
 RAISE NOTICE 'PASS app write and unsafe RPC privileges denied';
END $$;
RESET ROLE;
ROLLBACK;