-- 014-alle-messungen.sql
-- ALLE gespeicherten Werte ALLER Aktivitätsmessungen (je Auftrag/Probe/Messung) – damit die einheitliche Ansicht
-- gegen die echten Daten geprüft werden kann (welche Aufträge sehen noch anders aus?).
-- NUR SELECT – ändert nichts. EINE Abfrage: im Dev-Studio ausführen, Ergebnis als CSV exportieren und als
-- tasks/014-alle-messungen.csv ablegen. Wichtig: im Export KEIN Zeilenlimit (alle Zeilen) und remarks NICHT kürzen.
--
-- Spalten (wie in der App gespeichert): auftrag, probennummer, probenbezeichnung, messung, messart, result_name,
-- display_label, value, unit, is_official, instance_key, remarks.

select mo.order_number as auftrag,
       sa.sample_number as probennummer,
       sa.sample_name as probenbezeichnung,
       om.measurement_number as messung,
       s.service_name as messart,
       r.result_name, r.display_label, r.value, r.unit, r.is_official, r.instance_key, r.remarks
from public.measurement_results r
join public.order_measurements om on om.id = r.order_measurement_id
join public.measurement_orders mo on mo.id = om.order_id
join public.measurement_services s on s.id = om.service_id
left join public.samples sa on sa.id = om.sample_id
where s.service_name ilike '%aktivit%'
  and mo.order_type <> 'internal'
order by mo.order_number, sa.sample_number, om.measurement_number, r.result_name;
