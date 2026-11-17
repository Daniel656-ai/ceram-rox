CREATE OR REPLACE FUNCTION public._order_delete_links(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _ids uuid[]; _r jsonb; _sig text;
BEGIN
  SELECT coalesce(array_agg(id ORDER BY id), ARRAY[]::uuid[]) INTO _ids FROM order_measurements WHERE order_id=_order_id;
  SELECT jsonb_build_object(
    'samples', (SELECT count(*) FROM samples WHERE order_id=_order_id OR pilot_plant_order_id=_order_id OR prepared_for_measurement_id=ANY(_ids)),
    'services', cardinality(_ids),
    'assignments', (SELECT count(*) FROM order_measurements WHERE id=ANY(_ids) AND assigned_to IS NOT NULL),
    'tasks', (SELECT count(*) FROM order_workflow_tasks WHERE order_id=_order_id),
    'results_official', (SELECT count(*) FROM measurement_results WHERE order_measurement_id=ANY(_ids) AND is_official IS TRUE),
    'results_preliminary', (SELECT count(*) FROM measurement_results WHERE order_measurement_id=ANY(_ids) AND is_official IS NOT TRUE),
    'raw_datasets', (SELECT count(*) FROM measurement_raw_datasets WHERE order_measurement_id=ANY(_ids)),
    'corrections', (SELECT count(*) FROM measurement_result_corrections WHERE order_measurement_id=ANY(_ids) OR order_id=_order_id),
    'imports', (SELECT count(*) FROM measurement_import_operations WHERE order_measurement_id=ANY(_ids)),
    'work_logs', (SELECT count(*) FROM work_logs WHERE order_measurement_id=ANY(_ids)),
    'time_entries', (SELECT count(*) FROM project_time_entries WHERE order_id=_order_id),
    'materials', (SELECT count(*) FROM project_knetung_materials WHERE order_measurement_id=ANY(_ids)),
    'documents', (SELECT count(*) FROM documents WHERE order_measurement_id=ANY(_ids)),
    'uploads', (SELECT count(*) FROM order_upload_files WHERE measurement_id=ANY(_ids)),
    'reports', (SELECT count(*) FROM order_reports WHERE order_id=_order_id),
    'project', (SELECT CASE WHEN project_id IS NULL THEN 0 ELSE 1 END FROM measurement_orders WHERE id=_order_id),
    'production_releases', (SELECT count(*) FROM production_releases WHERE order_id=_order_id),
    'production_documents', (SELECT count(*) FROM production_document_requests WHERE order_id=_order_id),
    'follow_up_measurements', (SELECT count(*) FROM order_measurements WHERE source_measurement_id=ANY(_ids) AND order_id<>_order_id),
    'produced_samples', (SELECT count(*) FROM pilot_plant_produced_samples WHERE order_id=_order_id)
  ) INTO _r;
  SELECT md5(_r::text || coalesce((SELECT string_agg(id::text, ',' ORDER BY id) FROM measurement_results WHERE order_measurement_id=ANY(_ids)),'')
    || coalesce((SELECT string_agg(id::text, ',' ORDER BY id) FROM samples WHERE order_id=_order_id),'')
    || array_to_string(_ids, ',')) INTO _sig;
  RETURN jsonb_build_object('links', _r, 'hash', _sig);
END $$;
REVOKE ALL ON FUNCTION public._order_delete_links(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.preview_force_delete_order(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _o measurement_orders%ROWTYPE; _master boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Bitte erneut anmelden.' USING ERRCODE='42501'; END IF;
  SELECT * INTO _o FROM measurement_orders WHERE id=_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auftrag nicht vorhanden oder bereits gelöscht.' USING ERRCODE='P0002'; END IF;
  _master := has_role(_uid,'master'::app_role);
  IF NOT (_master OR (_o.created_by=_uid AND has_role(_uid,'auftraggeber'::app_role))) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Löschen dieses Auftrags.' USING ERRCODE='42501';
  END IF;
  RETURN _order_delete_links(_order_id) || jsonb_build_object(
    'order_number', _o.order_number, 'mode', CASE WHEN _master THEN 'force' ELSE 'requester' END,
    'blocked_reason', CASE WHEN _o.order_type='internal' THEN 'internal' WHEN _master AND is_order_locked(_order_id) THEN NULL ELSE NULL END);
END $$;
GRANT EXECUTE ON FUNCTION public.preview_force_delete_order(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.force_delete_order(_order_id uuid, _expected_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _o measurement_orders%ROWTYPE; _ids uuid[]; _cur jsonb; _snap jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Bitte erneut anmelden.' USING ERRCODE='42501'; END IF;
  IF NOT has_role(_uid,'master'::app_role) THEN
    -- Nicht-Master: unveränderte Regeln aus cancel_or_delete_order
    RETURN cancel_or_delete_order(_order_id);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('order_delete:' || _order_id::text, 0));
  SELECT * INTO _o FROM measurement_orders WHERE id=_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auftrag nicht vorhanden oder bereits gelöscht.' USING ERRCODE='P0002'; END IF;
  IF _o.order_type='internal' THEN
    RAISE EXCEPTION 'Interne Prüfaufträge bitte ausschließlich in der Prüfmittelüberwachung abbrechen.';
  END IF;
  PERFORM 1 FROM order_measurements WHERE order_id=_order_id ORDER BY id FOR UPDATE;
  _cur := _order_delete_links(_order_id);
  IF _expected_hash IS NULL OR _cur->>'hash' <> _expected_hash THEN
    RAISE EXCEPTION 'Die Verknüpfungen des Auftrags haben sich seit der Anzeige geändert. Bitte Übersicht neu laden.' USING ERRCODE='40001';
  END IF;
  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO _ids FROM order_measurements WHERE order_id=_order_id;
  SELECT jsonb_build_object('order',to_jsonb(_o),'links',_cur->'links',
    'measurements',coalesce((SELECT jsonb_agg(to_jsonb(m)) FROM order_measurements m WHERE id=ANY(_ids)),'[]'),
    'parameters',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM measurement_parameters p WHERE order_measurement_id=ANY(_ids)),'[]'),
    'results',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM measurement_results r WHERE order_measurement_id=ANY(_ids)),'[]'),
    'raw_datasets',coalesce((SELECT jsonb_agg(to_jsonb(d) - 'raw_data') FROM measurement_raw_datasets d WHERE order_measurement_id=ANY(_ids)),'[]'),
    'work_logs',coalesce((SELECT jsonb_agg(to_jsonb(w)) FROM work_logs w WHERE order_measurement_id=ANY(_ids)),'[]'),
    'documents',coalesce((SELECT jsonb_agg(to_jsonb(d)) FROM documents d WHERE order_measurement_id=ANY(_ids)),'[]'),
    'uploads',coalesce((SELECT jsonb_agg(to_jsonb(u)) FROM order_upload_files u WHERE measurement_id=ANY(_ids)),'[]'),
    'order_audit',coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM order_audit_log a WHERE order_id=_order_id),'[]'),
    'unlinked_samples',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'sample_number',sample_number)) FROM samples WHERE order_id=_order_id OR pilot_plant_order_id=_order_id OR prepared_for_measurement_id=ANY(_ids)),'[]'),
    'unlinked_releases',coalesce((SELECT jsonb_agg(id) FROM production_releases WHERE order_id=_order_id),'[]'),
    'unlinked_production_documents',coalesce((SELECT jsonb_agg(id) FROM production_document_requests WHERE order_id=_order_id),'[]')
  ) INTO _snap;
  PERFORM set_config('app.bypass_order_lock','on',true);
  -- eigenständige Datensätze entkoppeln, nicht löschen
  UPDATE production_document_requests SET order_id=NULL WHERE order_id=_order_id;
  UPDATE production_releases SET order_id=NULL WHERE order_id=_order_id;
  UPDATE samples SET order_id=NULL WHERE order_id=_order_id;
  UPDATE samples SET pilot_plant_order_id=NULL WHERE pilot_plant_order_id=_order_id;
  UPDATE samples SET prepared_for_measurement_id=NULL WHERE prepared_for_measurement_id=ANY(_ids);
  UPDATE order_measurements SET source_measurement_id=NULL WHERE source_measurement_id=ANY(_ids) AND order_id<>_order_id;
  UPDATE project_time_entries SET order_id=NULL WHERE order_id=_order_id;
  UPDATE project_knetung_materials SET order_measurement_id=NULL WHERE order_measurement_id=ANY(_ids);
  UPDATE activity_log SET order_id=NULL, order_measurement_id=NULL,
    metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('deleted_order_id',_order_id,'deleted_order_number',_o.order_number,'deleted_measurement_id',order_measurement_id)
    WHERE order_id=_order_id OR order_measurement_id=ANY(_ids);
  INSERT INTO activity_log(event_type,actor_user_id,project_id,metadata)
    VALUES('order_force_deleted',_uid,_o.project_id,_snap || jsonb_build_object('deleted_order_id',_order_id,'order_number',_o.order_number,'deleted_at',now()));
  DELETE FROM measurement_orders WHERE id=_order_id;
  IF NOT FOUND OR EXISTS(SELECT 1 FROM order_measurements WHERE order_id=_order_id) THEN
    RAISE EXCEPTION 'Auftrag konnte nicht vollständig gelöscht werden. Es wurden keine Änderungen übernommen.';
  END IF;
  RETURN _order_id;
END $$;
REVOKE ALL ON FUNCTION public.force_delete_order(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.force_delete_order(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public._m3_delete_links(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'release', (SELECT jsonb_build_object('id',r.id,'release_number',r.release_number,'revision_number',r.revision_number,
                 'project_name',r.project_name,'customer_name',r.customer_name,'article_number',r.article_number)
                FROM production_releases r WHERE r.id=d.based_on_release_id),
    'order', (SELECT jsonb_build_object('id',o.id,'order_number',o.order_number) FROM measurement_orders o WHERE o.id=d.order_id),
    'samples', (SELECT count(*) FROM samples s WHERE d.order_id IS NOT NULL AND s.order_id=d.order_id),
    'form_value_keys', (SELECT count(*) FROM jsonb_object_keys(coalesce(d.form_values,'{}'::jsonb))),
    'hash', md5(coalesce(d.order_id::text,'') || coalesce(d.based_on_release_id::text,'') || coalesce(d.form_values::text,'')))
  FROM production_document_requests d WHERE d.id=_id AND d.doc_kind='m3_list';
$$;
REVOKE ALL ON FUNCTION public._m3_delete_links(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.preview_delete_m3_list(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _r jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT has_role(auth.uid(),'master'::app_role) THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen m³-Listen löschen.' USING ERRCODE='42501'; END IF;
  _r := _m3_delete_links(_id);
  IF _r IS NULL THEN RAISE EXCEPTION 'm³-Liste nicht vorhanden oder bereits gelöscht.' USING ERRCODE='P0002'; END IF;
  RETURN _r;
END $$;
GRANT EXECUTE ON FUNCTION public.preview_delete_m3_list(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_m3_list(_id uuid, _expected_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _row production_document_requests%ROWTYPE; _r jsonb;
BEGIN
  IF _uid IS NULL OR NOT has_role(_uid,'master'::app_role) THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen m³-Listen löschen.' USING ERRCODE='42501'; END IF;
  SELECT * INTO _row FROM production_document_requests WHERE id=_id AND doc_kind='m3_list' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'm³-Liste nicht vorhanden oder bereits gelöscht.' USING ERRCODE='P0002'; END IF;
  _r := _m3_delete_links(_id);
  IF _expected_hash IS NULL OR _r->>'hash' <> _expected_hash THEN
    RAISE EXCEPTION 'Die m³-Liste wurde seit der Anzeige geändert. Bitte Übersicht neu laden.' USING ERRCODE='40001'; END IF;
  INSERT INTO activity_log(event_type,actor_user_id,metadata)
    VALUES('m3_list_deleted',_uid,jsonb_build_object('m3_list',to_jsonb(_row),'links',_r,'deleted_at',now()));
  DELETE FROM production_document_requests WHERE id=_id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.delete_m3_list(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_m3_list(uuid,text) TO authenticated;

DROP POLICY IF EXISTS "Authenticated manage production_document_requests" ON public.production_document_requests;
CREATE POLICY "Authenticated insert production_document_requests" ON public.production_document_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update production_document_requests" ON public.production_document_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Master delete production_document_requests" ON public.production_document_requests FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'master'::public.app_role));