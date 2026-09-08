---
name: Fertigungsfreigabe-Identifikation (Neuanlage vs. Revision)
description: Zuordnung ausschließlich über Dateinamen-Kennung Variante-Auftrag (0075-6106) + _RevX; nie über Inhalte wie Artikelnummer/Stückzahl
type: feature
---
- Kennung: `VVVV-AAAA` (Zelligkeit/Variante – Auftragsnummer), z. B. `0075-6106`; Dateiname ist führend, Dokumenttext nur Fallback.
- Andere Auftragsnummer (`0075-6107`) = NEUE Fertigungsfreigabe, auch bei identischen technischen Daten. Artikelnummer/Zeichnung/Kostenstelle dürfen NICHT zur Zuordnung dienen.
- `_RevX` im Dateinamen = Revision X der bestehenden Freigabe; Vergleich immer gegen den aktuell gültigen Stand.
- `_RevX` ohne auffindbaren Stammsatz → KEINE automatische Neuanlage; Benutzer ordnet manuell zu oder legt ausdrücklich neu an (REVISION_UNMATCHED).
- `_RevX` nicht neuer als aktueller Stand → blockiert (REVISION_NOT_NEWER). Rev-Sprung → Warnung.
- Gleiche Kennung ohne `_RevX` → als nächste Revision behandelt, mit Hinweis.
- Rote/durchgestrichene Werte dienen nur der Änderungserkennung/-darstellung, nie der Entscheidung Neu/Revision.
