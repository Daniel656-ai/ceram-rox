-- Zelligkeiten und Reaktorgeometrien als normale Stammdaten-Kategorien (analog Mundstücke)
insert into public.global_lists (list_key, display_name, description, category)
select 'zelligkeiten', 'Zelligkeiten', 'Verfügbare Zelligkeiten (Zellenzahl) für die Geometrie- und Auslegungsberechnung', 'geometrie'
where not exists (select 1 from public.global_lists where list_key = 'zelligkeiten');

insert into public.global_lists (list_key, display_name, description, category)
select 'reaktorgeometrien', 'Reaktorgeometrien', 'Messkonfigurationen mit zugehöriger Reaktorgeometrie', 'geometrie'
where not exists (select 1 from public.global_lists where list_key = 'reaktorgeometrien');

insert into public.global_list_attributes (list_id, attribute_key, display_name, data_type, unit, is_required, show_in_table, sort_order)
select l.id, 'zellenzahl', 'Zellenzahl', 'number', null, true, true, 1
from public.global_lists l
where l.list_key = 'zelligkeiten'
  and not exists (select 1 from public.global_list_attributes a where a.list_id = l.id and a.attribute_key = 'zellenzahl');

insert into public.global_list_attributes (list_id, attribute_key, display_name, data_type, unit, is_required, show_in_table, sort_order)
select l.id, x.k, x.n, 'number', 'mm', true, true, x.o
from public.global_lists l
cross join (values ('breite_mm','Breite',1), ('hoehe_mm','Höhe',2)) as x(k, n, o)
where l.list_key = 'reaktorgeometrien'
  and not exists (select 1 from public.global_list_attributes a where a.list_id = l.id and a.attribute_key = x.k);

insert into public.global_list_items (list_id, item_value, label, description, metadata, sort_order)
select l.id, x.v, x.lbl, x.descr, x.meta::jsonb, x.o
from public.global_lists l
cross join (values
  ('standard', 'Standard Aktivität', 'Reaktor 3 × 3 cm', '{"breite_mm": 30, "hoehe_mm": 30}', 1),
  ('sox', 'SOx', 'Reaktor 3,5 × 3,5 cm', '{"breite_mm": 35, "hoehe_mm": 35}', 2)
) as x(v, lbl, descr, meta, o)
where l.list_key = 'reaktorgeometrien'
  and not exists (select 1 from public.global_list_items i where i.list_id = l.id and i.item_value = x.v);