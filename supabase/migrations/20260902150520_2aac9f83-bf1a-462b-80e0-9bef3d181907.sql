DO $$
DECLARE
  v_form uuid := gen_random_uuid();
  v_rep uuid := gen_random_uuid();
  v_temp uuid := gen_random_uuid();
  v_anz uuid := gen_random_uuid();
  v_mund uuid := gen_random_uuid();
  v_service uuid := '821d4849-f903-47a1-827d-cf64ccac7f18';
BEGIN
  INSERT INTO public.form_definitions (id, name, description, scope, version, layout)
  VALUES (v_form, 'Extrusion', 'Vorgaben des Auftraggebers (Brenntemperaturen + Aktivitätsproben) und daraus abgeleiteter Extrusionsbedarf.', 'global', 1, '{}'::jsonb);

  INSERT INTO public.form_fields (id, form_id, field_key, display_name, description, field_type, unit, is_required, sort_order, metadata)
  VALUES (v_rep, v_form, 'brenntemperaturen', 'Brenntemperaturen (Vorgabe Auftraggeber)', 'Bis zu 4 Brenntemperaturen mit der jeweils gewünschten Anzahl an Aktivitätsproben.', 'repeater', NULL, false, 0,
    jsonb_build_object('repeater', jsonb_build_object(
      'min_entries', 1, 'max_entries', 4, 'item_label', 'Brenntemperatur',
      'add_label', 'Brenntemperatur hinzufügen', 'table_view', true,
      'layout', jsonb_build_object('version', 1, 'items', jsonb_build_array(
        jsonb_build_object('id','it_temp','type','field','key','brenntemperatur','width',6),
        jsonb_build_object('id','it_anz','type','field','key','anzahl_aktivitaetsproben','width',6)
      ))
    )));

  INSERT INTO public.form_fields (id, form_id, field_key, display_name, field_type, unit, is_required, decimal_places, sort_order, parent_field_id)
  VALUES
    (v_temp, v_form, 'brenntemperatur', 'Brenntemperatur', 'number', '°C', true, 0, 0, v_rep),
    (v_anz, v_form, 'anzahl_aktivitaetsproben', 'Anzahl Aktivitätsproben', 'number', 'Stk', true, 0, 1, v_rep);

  INSERT INTO public.form_fields (id, form_id, field_key, display_name, description, field_type, is_required, readonly, default_value, sort_order)
  VALUES (v_mund, v_form, 'mundstueck_raumgewicht', 'Mundstück Raumgewicht', 'Für die Raumgewichtsprobe ist Mundstück 293 fix vorgesehen.', 'text', false, true, '293', 1);

  INSERT INTO public.form_calculations (form_id, calc_key, display_name, description, formula, unit, decimals, rounding, sort_order, is_result, result_label)
  VALUES
    (v_form, 'aktivitaetsproben_gesamt', 'Aktivitätsproben gesamt', 'Summe der vom Auftraggeber vorgegebenen Aktivitätsproben über alle Brenntemperaturen.',
     'SUM(brenntemperaturen.anzahl_aktivitaetsproben)', 'Stk', 0, 'round', 0, true, 'Aktivitätsproben gesamt'),
    (v_form, 'extrudate_aktivitaet', 'Extrudate für Aktivitätsmessung', 'Je Extrudat können 2 Aktivitätsproben gefertigt werden – es wird aufgerundet.',
     'CEIL(aktivitaetsproben_gesamt / 2)', 'Stk', 0, 'ceil', 1, true, 'Extrudate Aktivität'),
    (v_form, 'extrudate_raumgewicht', 'Extrudat für Raumgewicht', 'Zusätzliches Extrudat für die Raumgewichtsbestimmung (Mundstück 293).',
     '1', 'Stk', 0, 'round', 2, false, NULL),
    (v_form, 'extrusionsbedarf_gesamt', 'Extrusionsbedarf gesamt', 'Extrudate für Aktivitätsmessung zuzüglich Raumgewichtsextrudat.',
     'extrudate_aktivitaet + extrudate_raumgewicht', 'Stk', 0, 'round', 3, true, 'Extrusionsbedarf gesamt');

  INSERT INTO public.form_role_views (form_definition_id, role_key, label, layout)
  VALUES
    (v_form, 'auftraggeber', 'Vorgaben Auftraggeber', jsonb_build_object('version', 1, 'nodes', jsonb_build_array(
      jsonb_build_object('id','n_rep','type','field','width',12,'visible',true,'field_id',v_rep),
      jsonb_build_object('id','n_sum','type','calculation','scope','local','calc_key','aktivitaetsproben_gesamt','width',6,'visible',true)
    ))),
    (v_form, 'durchfuehrer', 'Ausführung Extrusion', jsonb_build_object('version', 1, 'nodes', jsonb_build_array(
      jsonb_build_object('id','d_rep','type','field','width',12,'visible',true,'field_id',v_rep),
      jsonb_build_object('id','d_sum','type','calculation','scope','local','calc_key','aktivitaetsproben_gesamt','width',4,'visible',true),
      jsonb_build_object('id','d_akt','type','calculation','scope','local','calc_key','extrudate_aktivitaet','width',4,'visible',true),
      jsonb_build_object('id','d_ges','type','calculation','scope','local','calc_key','extrusionsbedarf_gesamt','width',4,'visible',true),
      jsonb_build_object('id','d_mund','type','field','width',6,'visible',true,'field_id',v_mund)
    )));

  UPDATE public.form_definitions
  SET layout = jsonb_build_object('version', 1, 'nodes', jsonb_build_array(
    jsonb_build_object('id','g_rep','type','field','width',12,'visible',true,'field_id',v_rep),
    jsonb_build_object('id','g_sum','type','calculation','scope','local','calc_key','aktivitaetsproben_gesamt','width',4,'visible',true),
    jsonb_build_object('id','g_akt','type','calculation','scope','local','calc_key','extrudate_aktivitaet','width',4,'visible',true),
    jsonb_build_object('id','g_ges','type','calculation','scope','local','calc_key','extrusionsbedarf_gesamt','width',4,'visible',true),
    jsonb_build_object('id','g_mund','type','field','width',6,'visible',true,'field_id',v_mund)
  ))
  WHERE id = v_form;

  IF EXISTS (SELECT 1 FROM public.measurement_services WHERE id = v_service)
     AND NOT EXISTS (SELECT 1 FROM public.service_form_links WHERE service_id = v_service) THEN
    INSERT INTO public.service_form_links (service_id, form_definition_id, order_index, role_view)
    VALUES (v_service, v_form, 0, NULL);
  END IF;
END $$;