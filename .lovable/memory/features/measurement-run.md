---
name: Messdurchlauf (temporär)
description: Messdienstleister bündelt eigene Aufgaben nach Arbeitsplatz zu einem temporären Durchlauf mit Autosave; keine DB-Struktur
type: feature
---
- Rein temporär: Auswahl nur im Seitenzustand, Navigation über `/aufgaben/:id?run=id1,id2,…`. Nie persistieren, keine neue Tabelle.
- Beliebig viele Proben aus beliebig vielen Aufträgen; keine feste Seriengröße.
- Gruppierung: Arbeitsplatz der Messung → Standard-Arbeitsplatz der Dienstleistung → Fallback Dienstleistungsname. Keine fest codierte Verfahrensliste.
- Nur eigene zugewiesene Aufgaben; KEINE automatische Übernahme freier Aufgaben.
- Autosave nur im aktiven Durchlauf: serialisiert, Änderungszähler, Flush vor Probenwechsel (bei Fehler kein Wechsel). Autosave setzt nie neu is_official und löst keine Regel-/Abschlusslogik aus.
- `/aufgaben/:id` ohne `?run` bleibt unverändert.
