-- Aufgabe 019: Werden Servicepakete (Prüfprogramme) benutzt?  NUR SELECT, ändert nichts.
-- Hinweis: Die Spalte heißt order_measurements.source_package_id (nicht service_package_id).

-- 1) Gesamt: wie viele Messungen/Aufträge über ein Paket entstanden, erste/letzte Nutzung
SELECT
  count(*)                                   AS messungen_ueber_paket,
  count(DISTINCT order_id)                   AS auftraege_ueber_paket,
  min(created_at)                            AS erste_nutzung,
  max(created_at)                            AS letzte_nutzung
FROM public.order_measurements
WHERE source_package_id IS NOT NULL;

-- 2) Zum Vergleich: Anteil an allen Messungen
SELECT count(*) AS messungen_gesamt, count(DISTINCT order_id) AS auftraege_gesamt
FROM public.order_measurements;

-- 3) Je Paket: Nutzung (auch Pakete ohne Nutzung)
SELECT p.name, p.is_active,
       count(om.id)              AS messungen,
       count(DISTINCT om.order_id) AS auftraege,
       max(om.created_at)        AS zuletzt
FROM public.service_packages p
LEFT JOIN public.order_measurements om ON om.source_package_id = p.id
GROUP BY p.id, p.name, p.is_active
ORDER BY messungen DESC, p.name;

-- 4) Nutzung der letzten 12 Monate je Monat
SELECT date_trunc('month', created_at)::date AS monat, count(*) AS messungen, count(DISTINCT order_id) AS auftraege
FROM public.order_measurements
WHERE source_package_id IS NOT NULL
GROUP BY 1 ORDER BY 1 DESC LIMIT 12;
