WITH keys AS (
  SELECT id,
         regexp_replace(
           CASE WHEN result_name LIKE 'form:%'
                THEN substring(result_name from position(':' in substring(result_name from 6)) + 6)
                ELSE result_name END,
           '^.*\[[^]]*\]\.', '') AS field_key
  FROM public.measurement_results
  WHERE unit IS NULL OR btrim(unit) = ''
),
defs AS (
  SELECT field_key AS k, btrim(unit) AS u FROM public.form_fields WHERE unit IS NOT NULL AND btrim(unit) <> ''
  UNION ALL
  SELECT calc_key, btrim(unit) FROM public.form_calculations WHERE unit IS NOT NULL AND btrim(unit) <> ''
  UNION ALL
  SELECT field_key, btrim(unit) FROM public.service_data_fields WHERE unit IS NOT NULL AND btrim(unit) <> ''
),
unique_defs AS (
  SELECT k, min(u) AS u FROM defs GROUP BY k HAVING count(DISTINCT u) = 1
)
UPDATE public.measurement_results mr
SET unit = ud.u
FROM keys k
JOIN unique_defs ud ON ud.k = k.field_key
WHERE mr.id = k.id;