---
name: Fertigungsfreigabe-Revisionen
description: Revisionsmodell (Zeile je Revision), Freigabe nur explizit und atomar per DB-Funktion, alter Stand bleibt bis dahin gültig
type: feature
---
- Jede Revision ist eine eigene Zeile in `production_releases` (root_release_id, previous_release_id, is_current, superseded_at).
- PDF-Import einer Revision legt sie mit `is_current=false` an; der bisherige Stand bleibt aktuell. Pro Stammsatz max. eine offene Revision (Fehlercode REVISION_PENDING).
- Freigabe ausschließlich über `release_production_release_revision(uuid)` (atomar): prüft offene Prüfpunkte/unsichere Vorgaben, setzt alte Revision auf historisch (superseded_at), neue auf aktuell + import_status 'reviewed'. Fehlercodes im HINT (RELEASE_PENDING_CHANGES, RELEASE_ALREADY_CURRENT, RELEASE_SUPERSEDED, …).
- Status-Badges: „aktuell“ / „Freigabe ausstehend“ (is_current=false, superseded_at null) / „historisch“.
- Speicherfehler werden strukturiert geloggt (IDs, Revision, Benutzer, Schritt, Rohfehler); nie nur „Unbekannte Ursache“.
