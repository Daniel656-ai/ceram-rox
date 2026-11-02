# m³-Liste – Schriftgestaltung und Platzoptimierung, 02.11.2026

## Umgesetzt
- Ausschließlich Tabellen-Typografie geändert: Bildschirm 13 → 16 px (über 14 px), HTML 9 → 12 pt (über 10 pt), PDF 10 → 12 pt (über 11 pt). Tabelleninhalte und Überschriften durchgehend fett.
- Bildschirm-Zellen geringfügig höher; Mindestbreite 640 px, schmale Fenster behalten den bestehenden horizontalen Tabellen-Scrollbereich.
- Keine Änderungen an Formeln, Daten, Berechtigungen, TEST-Logik, Druckfunktionen, Datenbank, Backend oder Tauri/Rust.

## Geänderte Dateien
- `src/index.css`
- `src/lib/m3List/printM3Html.ts`
- `src/lib/m3List/pdfExport.ts`
- `src/lib/m3List/upperLayout.ts`
- `src/lib/m3List/__tests__/upperLayout.test.ts`
- `src/components/productionDocuments/M3ListForm.tsx`
- `AGENTS.md` (Regel zur rein lokalen Anordnung)
- `roadmap.md` und dieser Prüfbericht (Dokumentation)

## Prüfung
- 106 m³-Tests in 10 Dateien bestanden, davon zwei neue Tests zur unveränderten Feldzuordnung und sicheren Rückgabe unbekannter Layouts.
- Gesamtsuite: 902 Tests in 120 Dateien bestanden.
- Aktueller automatischer Build: OK.
- Angemeldete Browserprüfung an vorhandener m³-Liste; Schreibzugriffe während der Prüfung blockiert, keine Testdaten angelegt und nichts gespeichert.
- Tabelle sichtbar kontrolliert: Inhalte und Überschriften 16 px / Gewicht 700, alle Spalten lesbar.
- Fensterbreiten 1280, 1112, 760 und 480 px geprüft: keine Seitenverbreiterung; bei 480 px lokal horizontal scrollbar, nicht alle Spalten gleichzeitig sichtbar.
- Tatsächlicher PDF-Download über vorhandenen Button sowie tatsächliches HTML-Druckiframe über „PDF drucken“ geprüft. Beide Ausgaben auf A4 gerendert und visuell kontrolliert: jeweils eine Seite, keine abgeschnittenen Spalten, Tabelleninhalt fett und 12 pt. Kein physischer Druckertest.
- Keine Browser-Laufzeitfehler beobachtet. Bestehende TEST-Regressionsprüfungen bestanden; vorhandene Liste neutral, aktive Markierung nicht gespeichert oder umgeschaltet.

## Seitliche Anordnung: bestätigt und umgesetzt
Die reale Web-Liste hat die Abschnitte **Kopfdaten**, **Kontrollfelder** und **Berechnungen**; „Labor-Messungen“ ist ein Feld innerhalb der Berechnungen. Ein eigener Bereich **Auftragsdetails** existiert nicht.

Die anschließend bestätigte Zuordnung ist umgesetzt: Kopfdaten links, Kontrollfelder und Berechnungen rechts. „Labor-Messungen“ bleibt an seiner bisherigen Position innerhalb Berechnungen. Die vorhandenen Abschnittsinhalte, Feldidentitäten und Reihenfolgen bleiben erhalten. Nur die obere Ansicht wird lokal in native Spalten projiziert; unbekannte oder mehrdeutige Vorlagen bleiben unverändert. Keine persistente Layoutänderung.

Browser-Sichtprüfung: zwei Spalten bei 1280 und 1112 px Fensterbreite, untereinander bei 760 und 480 px. Umschaltung anhand verfügbarer Formularbreite (760 px), nicht anhand der Fensterbreite. Kein Überlappen beobachtet. Druckaufteilung bleibt bewusst unverändert, um die separat geprüfte A4-Ausgabe zu erhalten.

## Getrennte Abnahmen
- Web: Typografie, bestätigte seitliche Anordnung und beide A4-Druckausgaben geprüft.
- Desktop/Tauri und Firmen-Backend: nicht geprüft; die entscheidende Desktop-Abnahme bleibt offen.