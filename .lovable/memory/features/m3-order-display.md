---
name: m³-Auftragsanzeige
description: Auftragsbezeichnung in der m³-Liste = erste 9 Zeichen der Artikelnummer der Fertigungsfreigabe + Leerzeichen + verknüpfter Projektname
type: feature
---
- Quelle: production_releases.article_number (erste 9 Zeichen exakt, z. B. "0040-6129-125-0998" → "0040-6129") + " " + Projektname über production_releases.project_id.
- Nie die interne ROX-Auftragsnummer (z. B. SW-260023) verwenden; keine Ersatzwerte.
- Fehlt Artikelnummer oder Projekt: als unvollständig kennzeichnen, Zuordnung nicht automatisch ändern.
- Reine Darstellung; order_number für Plausibilität/Berechnung unverändert.
