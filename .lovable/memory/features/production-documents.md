---
name: Fertigungsunterlagen
description: Übergeordneter Bereich mit Fertigungsfreigaben, m³-Liste und Dokumentation als auftragsbezogene Folgeprozesse
type: feature
---
- Navigationspunkt „Fertigungsfreigaben“ heißt jetzt „Fertigungsunterlagen“ (`/fertigungsunterlagen`, alte Route leitet weiter). Drei Reiter: Fertigungsfreigaben (bestehende Logik unverändert), m³-Liste, Dokumentation.
- m³-Liste und Dokumentation sind KEINE Dienstleistungen; sie sind auftragsbezogene Folgeprozesse in `production_document_requests` (order_id + doc_kind eindeutig, Status, based_on_release_id, missing[]).
- Fertigungsfreigaben werden über `production_releases.order_id` einem Auftrag zugeordnet (gesamter Stammsatz inkl. Revisionen); Grundlage ist immer die Revision mit `is_current`.
- Voraussetzungen werden ausschließlich aus vorhandenen Auftragsdaten abgeleitet (`src/lib/productionDocuments/requirements.ts`): m³ braucht aktuelle Freigabe + abgeschlossene Geometrievermessung mit Ergebnissen; Dokumentation zusätzlich Proben, Messergebnisse und erstellte m³-Liste.
- Anforderungen gehen nie verloren: Status wechselt automatisch zwischen „Wartet auf Daten“ und „Daten vollständig“; „In Erstellung“/„Erstellt“ werden manuell gesetzt.
