UPDATE public.service_data_fields
SET is_result = true,
    result_label = COALESCE(NULLIF(result_label, ''), display_name),
    updated_at = now()
WHERE field_type = 'computed'
  AND field_key = 'porenvolumen'
  AND display_name = 'Porenvolumen (Mittelwert)';

UPDATE public.measurement_results mr
SET is_official = true,
    display_label = 'Porenvolumen (Mittelwert)'
FROM public.order_measurements om
JOIN public.service_data_fields sdf
  ON sdf.service_id = om.service_id
WHERE mr.order_measurement_id = om.id
  AND mr.result_name = sdf.field_key
  AND sdf.field_type = 'computed'
  AND sdf.field_key = 'porenvolumen'
  AND sdf.display_name = 'Porenvolumen (Mittelwert)'
  AND sdf.is_result = true;