-- 014-pruefung.sql
-- Prüfung zur Aufgabe 014 (Aktivitätsmessung in der Ergebnisdatenbank).
-- NUR SELECT – ändert nichts. Im Dev-Studio nacheinander ausführen und die Ergebnisse an Claude schicken.
-- Tabellen laut src/integrations/supabase/types.ts:
--   measurement_results (order_measurement_id, result_name, display_label, value, unit, remarks, is_official,
--                        instance_key, instance_label, instance_context),
--   order_measurements (id, order_id, sample_id, service_id, measurement_number),
--   measurement_services (id, service_name), samples (id, sample_number, sample_name),
--   form_definitions (id, name), form_fields (form_id, field_key, display_name, field_type, unit, parent_field_id, metadata),
--   form_calculations (form_id, calc_key, display_name, formula, unit, decimals, is_result, result_label).
-- Hinweis: Ist "613" nur ein Teil der Probennummer (z. B. P260613), findet die Suche sie trotzdem (like '%613').

-- 1) Wie heißt die Messart? (Aktivitätsmessung / NOx …)
select id, service_name
from public.measurement_services
where service_name ilike '%aktiv%' or service_name ilike '%nox%' or service_name ilike '%denox%'
order by service_name;

-- 2) Probe 613: Probe, Auftrag und die Messungen der Aktivitätsmessung
select sa.sample_number, sa.sample_name, om.id as messung_id, om.measurement_number, s.service_name,
       (select count(*) from public.measurement_results r where r.order_measurement_id = om.id) as anzahl_werte
from public.samples sa
join public.order_measurements om on om.sample_id = sa.id
join public.measurement_services s on s.id = om.service_id
where sa.sample_number like '%613' and (s.service_name ilike '%aktiv%' or s.service_name ilike '%nox%')
order by om.measurement_number;

-- 3) ALLE gespeicherten Werte dieser Aktivitätsmessung(en) von Probe 613 – so wie sie in der Datenbank stehen.
--    Zeigt Feldnamen, Einheit, Durchlauf/Temperaturstufe (instance_*), offiziell/vorläufig und strukturierte Werte (remarks).
select sa.sample_number, om.measurement_number,
       r.result_name, r.display_label, r.value, r.unit, r.is_official,
       r.instance_key, r.instance_label, r.instance_context::text as instance_context,
       left(r.remarks, 600) as remarks_gekuerzt
from public.measurement_results r
join public.order_measurements om on om.id = r.order_measurement_id
join public.samples sa on sa.id = om.sample_id
join public.measurement_services s on s.id = om.service_id
where sa.sample_number like '%613' and (s.service_name ilike '%aktiv%' or s.service_name ilike '%nox%')
order by om.measurement_number, r.instance_key nulls first, r.result_name;

-- 4) Welche Feldnamen/Einheiten kommen in ALLEN Aktivitätsmessungen vor? (Häufigkeit)
--    Hier sieht man, wie NO2, N2O, NH3, CO, CO2, "in"/"out" tatsächlich benannt sind und welche Einheit daran hängt.
select coalesce(r.display_label, r.result_name) as feld, r.result_name, r.unit, r.is_official,
       count(*) as anzahl, count(distinct om.id) as messungen
from public.measurement_results r
join public.order_measurements om on om.id = r.order_measurement_id
join public.measurement_services s on s.id = om.service_id
where s.service_name ilike '%aktiv%' or s.service_name ilike '%nox%'
group by 1, 2, 3, 4
order by anzahl desc, feld;

-- 5) NO2 / N2O gezielt: alle Felder, deren Name oder Wert NO2/N2O enthält (Schreibweisen: NO2, no2, NO_2, NO₂, N2O …)
select coalesce(r.display_label, r.result_name) as feld, r.result_name, r.unit,
       count(*) as anzahl, min(r.value) as min_wert, max(r.value) as max_wert,
       count(*) filter (where r.value is null) as ohne_zahlenwert,
       min(left(r.remarks, 120)) as beispiel_text
from public.measurement_results r
where lower(coalesce(r.display_label, '') || ' ' || r.result_name) ~ '(no_?2|n_?2_?o|no₂|n₂o|nitrous|stickstoffdioxid|lachgas)'
   or lower(coalesce(r.remarks, '')) ~ '"(no_?2|n_?2_?o)[a-z_]*"\s*:'
group by 1, 2, 3
order by anzahl desc;

-- 6) Strukturierte Werte (JSON in remarks) der Aktivitätsmessung: welche Schlüssel kommen vor?
--    (z. B. gas_einstellungen mit fr_trocken, av, no_in … – wird heute unter "Details" statt als Messwert gezeigt)
select coalesce(r.display_label, r.result_name) as feld, k.schluessel, count(*) as vorkommen
from public.measurement_results r
join public.order_measurements om on om.id = r.order_measurement_id
join public.measurement_services s on s.id = om.service_id
cross join lateral (
  select distinct m[1] as schluessel from regexp_matches(r.remarks, '"([A-Za-z0-9_]+)"\s*:', 'g') as m
) k
where r.value is null and left(ltrim(r.remarks), 1) in ('{', '[')
  and (s.service_name ilike '%aktiv%' or s.service_name ilike '%nox%')
group by 1, 2
order by feld, vorkommen desc, k.schluessel;

-- 7) Ein Beispiel je Feld für strukturierte Werte (gekürzt)
select distinct on (coalesce(r.display_label, r.result_name))
       coalesce(r.display_label, r.result_name) as feld, left(r.remarks, 900) as beispiel
from public.measurement_results r
join public.order_measurements om on om.id = r.order_measurement_id
join public.measurement_services s on s.id = om.service_id
where r.value is null and left(ltrim(r.remarks), 1) in ('{', '[')
  and (s.service_name ilike '%aktiv%' or s.service_name ilike '%nox%')
order by coalesce(r.display_label, r.result_name), r.created_at desc;

-- 8) Formular der Aktivitätsmessung: Felder (inkl. Unterfelder der Wiederholungstabelle) und Berechnungen.
--    Zeigt, wie AV, FR, NO/NH3/H2O/O2/N2, Temperatur, η NOx, K-Wert und die in/out-Gase definiert sind (Schlüssel, Name, Einheit).
select fd.name as formular, ff.field_key, ff.display_name, ff.field_type, ff.unit,
       (select p.field_key from public.form_fields p where p.id = ff.parent_field_id) as gehoert_zu
from public.form_fields ff
join public.form_definitions fd on fd.id = ff.form_id
where ff.field_key ~* '(^av|^fr|no_?2|n_?2_?o|nh_?3|^no|^co|h_?2_?o|o_?2|n_?2|temperatur|gas|eta|k_wert|aktiv)'
order by fd.name, ff.parent_field_id nulls first, ff.sort_order;

select fd.name as formular, fc.calc_key, fc.display_name, fc.formula, fc.unit, fc.decimals, fc.is_result, fc.result_label
from public.form_calculations fc
join public.form_definitions fd on fd.id = fc.form_id
where fc.calc_key ~* '(eta|k_wert|nox|aktiv|av|fr)'
order by fd.name, fc.sort_order;
