-- 018-pilotplant.sql
-- Bereich „Pilot Plant & Prototyping“: Zeilenzahlen, Kennzahlen und Beispielzeilen der beteiligten Tabellen.
-- NUR SELECT – ändert nichts. EINE Abfrage: im Dev-Studio ausführen, Ergebnis als CSV exportieren (ohne Zeilenlimit)
-- und als tasks/018-pilotplant.csv ablegen.
--
-- Spalten:
--   reihenfolge  Sortierung
--   art          Zeilenzahl = Anzahl; Kennzahl = abgeleitete Zahl (z. B. Aufträge mit/ohne Ablaufschritte);
--                Beispiel = eine echte Zeile (als Text, gekürzt auf 700 Zeichen)
--   tabelle      beteiligte Tabelle bzw. Themenbereich
--   merkmal      was gezählt/gezeigt wird
--   wert         Zahl bzw. Beispielzeile (Text)
-- Beispielzeilen sind die jeweils zuletzt eingefügten (ctid absteigend); sie können Namen/Notizen aus echten Aufträgen
-- enthalten – bitte vor dem Weitergeben kurz ansehen.

with pp as (
  select mo.id, mo.created_at
  from public.measurement_orders mo
  where mo.order_kind::text = 'pilot_plant' or coalesce(mo.is_pilot_plant_process, false)
),
pp_flags as (
  select pp.id,
         exists (select 1 from public.pilot_plant_blocks b where b.order_id = pp.id) as hat_bausteine,
         exists (select 1 from public.order_instances i where i.legacy_order_id = pp.id) as hat_ablauf_neu,
         exists (select 1 from public.order_workflow_tasks t where t.order_id = pp.id) as hat_workflow_alt,
         exists (select 1 from public.order_processes p where p.order_id = pp.id) as hat_prozess
  from pp
)
select * from (

  -- 1) Aufträge nach Art
  select 10 as reihenfolge, 'Zeilenzahl' as art, 'measurement_orders' as tabelle,
         'Aufträge nach order_kind: ' || coalesce(order_kind::text, '(leer)') as merkmal, count(*)::text as wert
  from public.measurement_orders group by order_kind
  union all
  select 11, 'Kennzahl', 'measurement_orders', 'Aufträge mit is_pilot_plant_process = true', count(*)::text
  from public.measurement_orders where coalesce(is_pilot_plant_process, false)
  union all
  select 12, 'Kennzahl', 'measurement_orders', 'Pilot-Plant-Aufträge insgesamt (order_kind oder Kennzeichen)', count(*)::text from pp
  union all
  select 13, 'Kennzahl', 'measurement_orders', 'Pilot-Plant-Aufträge mit Versuchsnummer (pp_experiment_number)', count(*)::text
  from public.measurement_orders mo join pp on pp.id = mo.id where nullif(btrim(mo.pp_experiment_number), '') is not null
  union all
  select 14, 'Kennzahl', 'measurement_orders', 'jüngster Pilot-Plant-Auftrag (angelegt am)', coalesce(max(created_at)::text, '–') from pp
  union all
  select 15, 'Kennzahl', 'measurement_orders', 'ältester Pilot-Plant-Auftrag (angelegt am)', coalesce(min(created_at)::text, '–') from pp

  -- 2) Welche Ablaufart haben die Pilot-Plant-Aufträge? (alte Bausteine / neuer Ablauf / altes Workflow / Prozess)
  union all
  select 20, 'Kennzahl', 'Überschneidung', 'PP-Aufträge MIT alten Bausteinen (pilot_plant_blocks)', count(*)::text from pp_flags where hat_bausteine
  union all
  select 21, 'Kennzahl', 'Überschneidung', 'PP-Aufträge MIT neuem Ablauf (order_instances)', count(*)::text from pp_flags where hat_ablauf_neu
  union all
  select 22, 'Kennzahl', 'Überschneidung', 'PP-Aufträge mit Bausteinen UND neuem Ablauf', count(*)::text from pp_flags where hat_bausteine and hat_ablauf_neu
  union all
  select 23, 'Kennzahl', 'Überschneidung', 'PP-Aufträge nur mit Bausteinen (ohne neuen Ablauf)', count(*)::text from pp_flags where hat_bausteine and not hat_ablauf_neu
  union all
  select 24, 'Kennzahl', 'Überschneidung', 'PP-Aufträge nur mit neuem Ablauf (ohne Bausteine)', count(*)::text from pp_flags where hat_ablauf_neu and not hat_bausteine
  union all
  select 25, 'Kennzahl', 'Überschneidung', 'PP-Aufträge mit weder Bausteinen noch neuem Ablauf', count(*)::text from pp_flags where not hat_bausteine and not hat_ablauf_neu
  union all
  select 26, 'Kennzahl', 'Überschneidung', 'PP-Aufträge mit altem Workflow (order_workflow_tasks)', count(*)::text from pp_flags where hat_workflow_alt
  union all
  select 27, 'Kennzahl', 'Überschneidung', 'PP-Aufträge mit Prozess (order_processes)', count(*)::text from pp_flags where hat_prozess

  -- 3) Alte Bausteine
  union all
  select 30, 'Zeilenzahl', 'pilot_plant_blocks', 'gesamt', count(*)::text from public.pilot_plant_blocks
  union all
  select 31, 'Zeilenzahl', 'pilot_plant_blocks', 'nach Status: ' || status::text, count(*)::text from public.pilot_plant_blocks group by status
  union all
  select 32, 'Kennzahl', 'pilot_plant_blocks', 'zuletzt geändert', coalesce(max(updated_at)::text, '–') from public.pilot_plant_blocks
  union all
  select 33, 'Kennzahl', 'pilot_plant_blocks', 'Bausteine mit ausgefüllten Daten (data <> {})', count(*)::text from public.pilot_plant_blocks where data <> '{}'::jsonb
  union all
  select 34, 'Zeilenzahl', 'pilot_plant_produced_samples', 'gesamt', count(*)::text from public.pilot_plant_produced_samples
  union all
  select 35, 'Kennzahl', 'pilot_plant_produced_samples', 'davon mit erzeugter Probe', count(*)::text from public.pilot_plant_produced_samples where created_sample_id is not null
  union all
  select 36, 'Kennzahl', 'pilot_plant_produced_samples', 'davon mit erzeugtem Folgeauftrag', count(*)::text from public.pilot_plant_produced_samples where created_order_id is not null
  union all
  select 37, 'Kennzahl', 'project_time_entries', 'Zeitbuchungen aus den alten Bausteinen (Notiz „Pilot-Plant: …“)', count(*)::text
  from public.project_time_entries where note like 'Pilot-Plant:%'

  -- 4) Neuer Ablauf (Prozessvorlagen und Ausführung)
  union all
  select 40, 'Zeilenzahl', 'process_templates', 'nach Art: ' || kind::text, count(*)::text from public.process_templates group by kind
  union all
  select 41, 'Zeilenzahl', 'process_steps', 'Schritte in Pilot-Plant-Vorlagen', count(*)::text
  from public.process_steps s join public.process_templates t on t.id = s.template_id where t.kind::text = 'pilot_plant'
  union all
  select 42, 'Zeilenzahl', 'order_instances', 'gesamt', count(*)::text from public.order_instances
  union all
  select 43, 'Kennzahl', 'order_instances', 'davon verknüpft mit einem PP-Auftrag', count(*)::text
  from public.order_instances i join pp on pp.id = i.legacy_order_id
  union all
  select 44, 'Zeilenzahl', 'order_step_runs', 'gesamt', count(*)::text from public.order_step_runs
  union all
  select 45, 'Kennzahl', 'order_step_runs', 'davon in PP-Aufträgen', count(*)::text
  from public.order_step_runs r join public.order_instances i on i.id = r.order_id join pp on pp.id = i.legacy_order_id
  union all
  select 46, 'Zeilenzahl', 'order_step_positions', 'gesamt', count(*)::text from public.order_step_positions

  -- 5) Messarten, Vorlagen, Herkunft, Proben
  union all
  select 50, 'Zeilenzahl', 'measurement_services', 'Messarten nach Kategorie: ' || coalesce(category::text, '(leer)'), count(*)::text
  from public.measurement_services group by category
  union all
  select 51, 'Kennzahl', 'order_measurements', 'Messungen mit Pilot-Plant-Messart', count(*)::text
  from public.order_measurements om join public.measurement_services s on s.id = om.service_id where s.category::text = 'pilot_plant'
  union all
  select 52, 'Zeilenzahl', 'order_kind_form_templates', 'gesamt', count(*)::text from public.order_kind_form_templates
  union all
  select 53, 'Zeilenzahl', 'work_object_origins', 'gesamt', count(*)::text from public.work_object_origins
  union all
  select 54, 'Zeilenzahl', 'workflow_templates', 'gesamt', count(*)::text from public.workflow_templates
  union all
  select 55, 'Zeilenzahl', 'samples', 'Proben mit Verweis auf einen Pilot-Plant-Auftrag (pilot_plant_order_id)', count(*)::text
  from public.samples where pilot_plant_order_id is not null
  union all
  select 56, 'Zeilenzahl', 'samples', 'Proben, die für eine Messung vorbereitet wurden (prepared_for_measurement_id)', count(*)::text
  from public.samples where prepared_for_measurement_id is not null

  -- 6) Beispielzeilen (neueste zuerst)
  union all
  select 100, 'Beispiel', 'pilot_plant_blocks', 'neueste Zeile', left(to_jsonb(x)::text, 700)
  from (select * from public.pilot_plant_blocks order by ctid desc limit 2) x
  union all
  select 101, 'Beispiel', 'pilot_plant_produced_samples', 'neueste Zeile', left(to_jsonb(x)::text, 700)
  from (select * from public.pilot_plant_produced_samples order by ctid desc limit 2) x
  union all
  select 102, 'Beispiel', 'process_templates (pilot_plant)', 'Zeile', left(to_jsonb(x)::text, 700)
  from (select * from public.process_templates where kind::text = 'pilot_plant' order by ctid desc limit 3) x
  union all
  select 103, 'Beispiel', 'order_instances (PP)', 'neueste Zeile', left(to_jsonb(x)::text, 700)
  from (select i.* from public.order_instances i join pp on pp.id = i.legacy_order_id order by i.ctid desc limit 2) x
  union all
  select 104, 'Beispiel', 'order_step_runs (PP)', 'neueste Zeile', left(to_jsonb(x)::text, 700)
  from (select r.* from public.order_step_runs r join public.order_instances i on i.id = r.order_id join pp on pp.id = i.legacy_order_id order by r.ctid desc limit 2) x
  union all
  select 105, 'Beispiel', 'order_kind_form_templates', 'Zeile', left(to_jsonb(x)::text, 700)
  from (select * from public.order_kind_form_templates limit 5) x
  union all
  select 106, 'Beispiel', 'work_object_origins', 'Zeile', left(to_jsonb(x)::text, 400)
  from (select * from public.work_object_origins limit 10) x
  union all
  select 107, 'Beispiel', 'measurement_orders (PP)', 'neuester PP-Auftrag (ohne Formularwerte)', left((to_jsonb(x) - 'shared_form_data' - 'notes')::text, 700)
  from (select mo.* from public.measurement_orders mo join pp on pp.id = mo.id order by mo.created_at desc limit 2) x
  union all
  select 108, 'Beispiel', 'measurement_services (pilot_plant)', 'Messarten der Kategorie Pilot Plant', left((to_jsonb(x))::text, 300)
  from (select id, service_name, category, standard_duration_hours from public.measurement_services where category::text = 'pilot_plant' order by service_name limit 20) x

) q
order by reihenfolge, tabelle, merkmal, wert;
