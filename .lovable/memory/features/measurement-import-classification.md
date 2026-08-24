---
name: Messdatenimport – Messwerte vs. Metadaten
description: Trennung echter Mess-/Ergebnisparameter von technischen Metadaten beim Messdatenimport; nicht zugeordnete Messwerte bleiben erhalten
type: feature
---

Zentrale Regel: „Keinen echten Messwert verlieren“ – NICHT „alles importieren“.

- `src/lib/measurementClassification.ts` klassifiziert jeden gelesenen Eintrag als `measurement` oder `metadata` (Namensmuster für Datum/Zeit/Methode/Gerät/Operator/Datei/Software/IDs/Kommentar/Status, Datums- und Zeitwerte, Einheitenerkennung).
- Metadaten werden nie als Ergebniswert übernommen, sondern nur als „Importinformationen“ (Quelldatei, Importdatum, Messdatum, Methode, Gerät, Operator) gespeichert.
- Echte Messwerte ohne passendes Formularfeld werden mit Status „nicht zugeordnet“ im Importfeld-JSON (`unassigned`) je Messblock-Instanz gespeichert und können im Formular nachträglich einem Ergebnisfeld zugeordnet werden.
- Parametername und Einheit werden getrennt (`splitNameUnit`): „As (PPM)“ → Parameter `As`, Einheit `ppm`. Zuordnung über `canonicalParameter` inkl. Aliasnamen (Arsenic→As, Lead→Pb) und ohne Beachtung der Groß-/Kleinschreibung.
