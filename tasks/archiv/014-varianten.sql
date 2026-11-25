-- 014-varianten.sql
-- Alle Feldnamen, Beschriftungen, Einheiten und die Block-Struktur ALLER Aktivitätsmessungen, je Formularversion.
-- NUR SELECT – ändert nichts. EINE Abfrage: im Dev-Studio ausführen, Ergebnis als CSV exportieren und als
-- tasks/014-varianten.csv ablegen.
--
-- Spalten:
--   art             Einzelfeld  = eigener gespeicherter Wert (auch die alte flache Bauart, z. B. "Temperatur 1", "NH₃₁")
--                   Block-Gruppe = Liste/Objekt im Aktivitätsmessblock (z. B. gas_einstellungen, temperatur_11)
--                   Block-Feld   = einzelnes Feld INNERHALB eines Blocks (z. B. no2_in_1, eta_nox, kat_nr)
--   formular_id     Formularversion (steckt im Namen des Ergebnisses: form:<id>:<feld>); leer bei Altdaten ohne Formular
--   formular_name   Name und Version laut form_definitions (falls vorhanden)
--   block_feld      bei Block-Gruppe/Block-Feld: in welchem Blockfeld es steht (z. B. aktivitatsmessblock)
--   schluessel      technischer Name des Feldes
--   beschriftung    sichtbare Bezeichnung (display_label) – bei Block-Feldern leer (Blöcke speichern nur Schlüssel)
--   einheit         gespeicherte Einheit
--   anzahl_mit_wert / anzahl_leer / anzahl_messungen  wie oft gefüllt / leer / in wie vielen Messungen
--   anzahl_offiziell Einzelfelder: wie viele sind offiziell
--   beispiel_wert   ein Beispielwert; beispiel_auftrag = kleinste Auftragsnummer, in der das Feld vorkommt
-- Die Messart wird wie in 014-pruefung.sql über den Namen gefunden (enthält "aktiv" oder "nox").

with akt as (
  select r.id, r.result_name, r.display_label, r.unit, r.value, r.remarks, r.is_official,
         om.id as messung_id, mo.order_number,
         case when r.result_name like 'form:%' then split_part(r.result_name, ':', 2) end as form_id,
         case when r.result_name like 'form:%' then substring(r.result_name from '^form:[^:]*:(.*)$')
              else r.result_name end as feld,
         (r.value is null and left(ltrim(coalesce(r.remarks, '')), 1) in ('[', '{')) as ist_block
  from public.measurement_results r
  join public.order_measurements om on om.id = r.order_measurement_id
  join public.measurement_orders mo on mo.id = om.order_id
  join public.measurement_services s on s.id = om.service_id
  where s.service_name ilike '%aktiv%' or s.service_name ilike '%nox%'
),
einzel as (
  select 'Einzelfeld'::text as art, a.form_id, null::text as block_feld, a.feld as schluessel,
         a.display_label as beschriftung, a.unit as einheit,
         count(*) filter (where a.value is not null or nullif(btrim(coalesce(a.remarks, '')), '') is not null) as anzahl_mit_wert,
         count(*) filter (where a.value is null and nullif(btrim(coalesce(a.remarks, '')), '') is null) as anzahl_leer,
         count(distinct a.messung_id) as anzahl_messungen,
         count(*) filter (where a.is_official) as anzahl_offiziell,
         max(coalesce(a.value::text, left(a.remarks, 60))) as beispiel_wert,
         min(a.order_number) as beispiel_auftrag
  from akt a
  where not a.ist_block
  group by a.form_id, a.feld, a.display_label, a.unit
),
block_treffer as (
  select a.form_id, a.feld as block_feld, a.messung_id, a.order_number, m[1] as k, m[2] as v
  from akt a
  cross join lateral regexp_matches(
    a.remarks,
    '"([A-Za-z0-9_]+)"\s*:\s*("[^"]*"|-?[0-9.eE+]+|null|true|false|\[|\{)',
    'g'
  ) as m
  where a.ist_block and m[1] not like '\_\_%'
),
bloecke as (
  select case when bool_or(b.v in ('[', '{')) then 'Block-Gruppe' else 'Block-Feld' end as art,
         b.form_id, b.block_feld, b.k as schluessel, null::text as beschriftung, null::text as einheit,
         count(*) filter (where b.v not in ('null', '""', '[', '{')) as anzahl_mit_wert,
         count(*) filter (where b.v in ('null', '""')) as anzahl_leer,
         count(distinct b.messung_id) as anzahl_messungen,
         null::bigint as anzahl_offiziell,
         max(b.v) filter (where b.v not in ('null', '""', '[', '{')) as beispiel_wert,
         min(b.order_number) as beispiel_auftrag
  from block_treffer b
  group by b.form_id, b.block_feld, b.k
),
alle as (
  select * from einzel
  union all
  select * from bloecke
)
select x.art, x.form_id as formular_id,
       fd.name || ' (v' || fd.version::text || ')' as formular_name,
       x.block_feld, x.schluessel, x.beschriftung, x.einheit,
       x.anzahl_mit_wert, x.anzahl_leer, x.anzahl_messungen, x.anzahl_offiziell,
       x.beispiel_wert, x.beispiel_auftrag
from alle x
left join public.form_definitions fd on fd.id::text = x.form_id
order by x.form_id nulls first, x.art, x.block_feld nulls first, x.schluessel;
