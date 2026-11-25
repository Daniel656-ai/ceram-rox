-- 017-tabellen.sql
-- Bestandsaufnahme: alle Tabellen im Schema public mit Zeilenanzahl, Spaltenanzahl, Größe, Fremdschlüsseln
-- (wer verweist auf wen), Zugriffsstatistik und Sicherheitsregeln.
-- NUR SELECT – ändert nichts. EINE Abfrage: im Dev-Studio ausführen, Ergebnis als CSV exportieren (ohne Zeilenlimit)
-- und als tasks/017-tabellen.csv ablegen.
--
-- Spalten:
--   tabelle            Name der Tabelle (Schema public)
--   zeilen             exakte Zeilenanzahl (count(*) per query_to_xml – nur lesend)
--   spalten            Anzahl Spalten
--   groesse / bytes    Gesamtgröße inkl. Indizes und TOAST
--   verweist_auf       Fremdschlüssel von dieser Tabelle auf andere (wer ist der "Elternteil")
--   wird_verwiesen_von Tabellen, die per Fremdschlüssel auf diese Tabelle zeigen (ohne sich selbst)
--   fk_aus / fk_ein    Anzahl Fremdschlüssel ausgehend / eingehend
--   gelesen            seq_scan + idx_scan seit dem letzten Zurücksetzen der Statistik (Hinweis, ob gelesen wird)
--   geschrieben        Einfügungen + Änderungen + Löschungen seit dem letzten Zurücksetzen der Statistik
--   rls / policies     Zeilenschutz aktiv? Anzahl Regeln (nur zur Einordnung, nichts wird geändert)
--   kommentar          Tabellenkommentar, falls vorhanden
-- Hinweis: Die Statistik (gelesen/geschrieben) beginnt beim letzten Neustart/Reset der Datenbank und ist nur ein Hinweis.

select c.relname as tabelle,
       (xpath('/row/c/text()',
              query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text::bigint as zeilen,
       (select count(*) from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as spalten,
       pg_size_pretty(pg_total_relation_size(c.oid)) as groesse,
       pg_total_relation_size(c.oid) as bytes,
       (select string_agg(distinct rt.relname, ', ' order by rt.relname)
          from pg_constraint k join pg_class rt on rt.oid = k.confrelid
         where k.contype = 'f' and k.conrelid = c.oid) as verweist_auf,
       (select string_agg(distinct rt.relname, ', ' order by rt.relname)
          from pg_constraint k join pg_class rt on rt.oid = k.conrelid
         where k.contype = 'f' and k.confrelid = c.oid and k.conrelid <> c.oid) as wird_verwiesen_von,
       (select count(*) from pg_constraint k where k.contype = 'f' and k.conrelid = c.oid) as fk_aus,
       (select count(*) from pg_constraint k where k.contype = 'f' and k.confrelid = c.oid and k.conrelid <> c.oid) as fk_ein,
       coalesce(s.seq_scan, 0) + coalesce(s.idx_scan, 0) as gelesen,
       coalesce(s.n_tup_ins, 0) + coalesce(s.n_tup_upd, 0) + coalesce(s.n_tup_del, 0) as geschrieben,
       c.relrowsecurity as rls,
       (select count(*) from pg_policy p where p.polrelid = c.oid) as policies,
       obj_description(c.oid, 'pg_class') as kommentar
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_stat_user_tables s on s.relid = c.oid
where n.nspname = 'public' and c.relkind in ('r', 'p')
order by zeilen desc, tabelle;
