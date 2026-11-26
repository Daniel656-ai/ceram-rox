-- Aufgabe 029: Formularänderungen der letzten 14 Tage (REINE SELECT-Abfragen, ändern nichts).
-- Gedacht für die Prod-DB (Lesezugriff). Jeden Block einzeln ausführen.
--
-- Grenzen (siehe Bericht): Es gibt keine Versionierung und kein "geändert von".
--  * form_definitions: nur created_by (Ersteller), updated_at (letzte Änderung, auch am Layout)
--  * form_fields:      nur created_at / updated_at, kein Benutzer
--  * form_calculations: created_by (Ersteller), updated_at
--  * Gelöschte Felder/Berechnungen sind nicht mehr auffindbar (harte Löschung).
-- "Neu" = created_at im Zeitraum, "geändert" = updated_at im Zeitraum (und nicht neu).

-- 1) Formulare: neu angelegt oder geändert (Name, Layout, archiviert)
SELECT
  f.name                                        AS formular,
  f.scope                                       AS art,
  f.version                                     AS version_spalte,   -- wird vom Code nicht hochgezählt
  CASE WHEN f.created_at >= now() - interval '14 days' THEN 'neu' ELSE 'geändert' END AS aenderung,
  f.updated_at                                  AS zeit,
  (p.first_name || ' ' || p.last_name)          AS ersteller,        -- NICHT zwingend der Änderer
  f.archived_at
FROM public.form_definitions f
LEFT JOIN public.profiles p ON p.user_id = f.created_by
WHERE f.updated_at >= now() - interval '14 days'
ORDER BY f.updated_at DESC;

-- 2) Felder: neu hinzugekommen oder geändert (z. B. neues Feld "Temperatur")
SELECT
  d.name                                        AS formular,
  ff.field_key                                  AS feld,
  ff.display_name                               AS bezeichnung,
  ff.field_type                                 AS typ,
  CASE WHEN ff.created_at >= now() - interval '14 days' THEN 'Feld neu' ELSE 'Feld geändert' END AS aenderung,
  ff.updated_at                                 AS zeit
FROM public.form_fields ff
JOIN public.form_definitions d ON d.id = ff.form_id
WHERE ff.updated_at >= now() - interval '14 days'
ORDER BY d.name, ff.updated_at DESC;

-- 3) Berechnungen: neu oder geändert
SELECT
  d.name                                        AS formular,
  c.calc_key                                    AS berechnung,
  c.formula,
  CASE WHEN c.created_at >= now() - interval '14 days' THEN 'Berechnung neu' ELSE 'Berechnung geändert' END AS aenderung,
  c.updated_at                                  AS zeit,
  (p.first_name || ' ' || p.last_name)          AS ersteller
FROM public.form_calculations c
JOIN public.form_definitions d ON d.id = c.form_id
LEFT JOIN public.profiles p ON p.user_id = c.created_by
WHERE c.updated_at >= now() - interval '14 days'
ORDER BY d.name, c.updated_at DESC;

-- 4) Nur falls die Tabelle in Prod existiert (steht in types.ts, aber ohne Migration im Repo).
--    Zuerst prüfen:  SELECT to_regclass('public.form_definition_versions');   -- NULL = gibt es nicht
-- SELECT d.name AS formular, v.version, v.created_at AS zeit,
--        (p.first_name || ' ' || p.last_name) AS benutzer, v.note
-- FROM public.form_definition_versions v
-- JOIN public.form_definitions d ON d.id = v.form_definition_id
-- LEFT JOIN public.profiles p ON p.user_id = v.created_by
-- WHERE v.created_at >= now() - interval '14 days'
-- ORDER BY v.created_at DESC;
--    Neu/entfernt gegenüber der Vorversion ließe sich dann aus v.snapshot (JSON) berechnen.
