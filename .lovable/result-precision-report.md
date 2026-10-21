# Nachkommastellen in der Ergebnisdatenbank – Abschlussbericht

## Ergebnis und Schutzgrenzen
Die Ergebnismatrix verwendet feste Nachkommastellen einschließlich nachgestellter Nullen, wenn die tatsächliche Definition eindeutig aufgelöst wird. Ohne sichere Zuordnung bleibt die bisherige Darstellung mit maximal sechs Nachkommastellen erhalten. Gespeicherte Werte, Berechnungen, offizielle Ergebnisse, Diagrammdaten, Filter, Sortierung und Exportwerte wurden nicht verändert. Keine Migration, Datenänderung oder Änderung an Infrastruktur, Authentifizierung, Berechtigungen oder Konfiguration.

## Zuordnungslogik
- Moderne Ergebnisse: exakte Formular-ID und Feldschlüssel aus dem bestehenden Ergebnisidentifikator.
- Messdatenblöcke: zusätzlich Speicher-Schlüssel des Blocks, eindeutiges Elternfeld und Kindfeld; widersprüchliche Messungskennung führt zum Fallback. Importelemente ohne eigenes Feld erhalten keine erfundene Präzision.
- Klassische Felder einschließlich berechneter Servicefelder: Dienstleistungs-ID plus exakter Feldschlüssel.
- Formularberechnungen: Formular-ID plus exakter Berechnungsschlüssel. `decimals` entspricht bereits der bestehenden Berechnungsanzeige; die Berechnung selbst bleibt unberührt.
- Mehrdeutige, fehlende oder ungültige Definitionen: Fallback.
- Präzision wird pro Ergebniszelle aufgelöst, nicht pro geteilter Spaltenbezeichnung: gleiche Anzeigenamen können unterschiedliche Definitionen haben. Deshalb keine Präzision in `ResultParamColumn` und keine Änderungen an der Schemaerstellung oder `ResultsDatabasePage` erforderlich.
- Feldinformationen werden separat und ausschließlich lesend über die bestehende Domain-API geladen. Bei nicht verfügbaren Definitionen bleibt die Matrix nutzbar.

## Geänderte Programmdateien
- `src/lib/resultDisplayPrecision.ts`: zentrale Auflösung und reine Anzeigeformatierung.
- `src/lib/api/measurementResults.ts`: zusätzliche lesende Domain-Abfrage für Präzisionsdefinitionen.
- `src/hooks/useResultDisplayPrecision.ts`: getrenntes Laden der tatsächlich benötigten Definitionen.
- `src/lib/resultSchema.ts`: bestehende Zellzuordnung für Präzisionsauflösung wiederverwendbar gemacht, Zuordnungsreihenfolge unverändert.
- `src/components/results/ResultsMatrixTable.tsx`: Zellformatierung mit eindeutig aufgelöster Präzision.
- `src/test/resultDisplayPrecision.test.ts`: 17 Testfälle.
- `AGENTS.md`: Regel für die zellbezogene Anzeigeauflösung.
- `roadmap.md`: Abnahmeumfang und offene Prüfungen.

## Automatisierte Prüfung
Alle 94 Testdateien mit 679 Tests erfolgreich. Neue Tests decken 0/1/2/4 Stellen, nachgestellte Nullen, Wert 0, leere/Textwerte, Formular- und Servicezuordnung, konkrete Berechnungen, Mehrdeutigkeiten, Blockinstanzen, historische Werte, ungültige Präzision und unveränderte Roh-/Exportwerte ab. Bestehende Tests für Ergebnisstruktur, Diagrammdaten und weitere Funktionen ebenfalls erfolgreich. Aktuelles Vorschau-Prüfprotokoll: build OK.

## Tatsächlich manuell im Web geprüft
Angemeldet unter `/ergebnisse`, ohne Datenspeicherung oder Testdatenerzeugung:
- Zwei vorhandene offizielle Porenvolumen-Ergebnisse sichtbar: `0,4191` und `0,2630`, inklusive nachgestellter Null.
- Definitionen erfolgreich gelesen (HTTP 200); verfügbare Servicefeld-Präzisionen 3 und 4.
- Volltextsuche nach einem der vorhandenen Aufträge reduziert die Tabelle auf eine Zeile; Löschen der Suche stellt beide Zeilen wieder her.
- Wechsel zur Diagrammansicht und zurück funktioniert. Kein Diagramm mit ausgewählten Achsen manuell ausgewertet.
- Keine beobachteten JavaScript-Laufzeitfehler.

## Noch offen
- BET mit einer Nachkommastelle: kein gespeichertes offizielles BET-Ergebnis im erreichbaren Bestand. Keine Testdaten dafür angelegt.
- Moderne Formular-/Berechnungsergebnisse und andere Präzisionen manuell: automatisiert geprüft, aber nicht anhand entsprechender vorhandener offizieller Web-Ergebnisse abgenommen.
- Desktop-Anwendung und Firmen-Datenbank: kein Zugriff; weder getestet noch Schema-Gleichheit behauptet.
- Manuelle vollständige Filter-/Sortier-/Diagrammabnahme: nicht durchgeführt; bestehende Logik nicht geändert und Regressionstests erfolgreich.