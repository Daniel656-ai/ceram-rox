# m³-Liste – Schriftgestaltung und Platzoptimierung, 02.11.2026

## Umgesetzt
- Ausschließlich Tabellen-Typografie geändert: Bildschirm 13 → 16 px (über 14 px), HTML 9 → 12 pt (über 10 pt), PDF 10 → 12 pt (über 11 pt). Tabelleninhalte und Überschriften durchgehend fett.
- Bildschirm-Zellen geringfügig höher; Mindestbreite 640 px, schmale Fenster behalten den bestehenden horizontalen Tabellen-Scrollbereich.
- Keine Änderungen an Formeln, Daten, Berechtigungen, TEST-Logik, Druckfunktionen, Datenbank, Backend oder Tauri/Rust.

## Geänderte Dateien
- `src/index.css`
- `src/lib/m3List/printM3Html.ts`
- `src/lib/m3List/pdfExport.ts`
- `roadmap.md` und dieser Prüfbericht (Dokumentation)

## Prüfung
- 104 vorhandene m³-Tests in 9 Dateien bestanden.
- Gesamtsuite: 900 Tests in 119 Dateien bestanden.
- Aktueller automatischer Build: OK.
- Angemeldete Browserprüfung an vorhandener m³-Liste; Schreibzugriffe während der Prüfung blockiert, keine Testdaten angelegt und nichts gespeichert.
- Tabelle sichtbar kontrolliert: Inhalte und Überschriften 16 px / Gewicht 700, alle Spalten lesbar.
- Fensterbreiten 1280, 1112, 760 und 480 px geprüft: keine Seitenverbreiterung; bei 480 px lokal horizontal scrollbar, nicht alle Spalten gleichzeitig sichtbar.
- Tatsächlicher PDF-Download über vorhandenen Button sowie tatsächliches HTML-Druckiframe über „PDF drucken“ geprüft. Beide Ausgaben auf A4 gerendert und visuell kontrolliert: jeweils eine Seite, keine abgeschnittenen Spalten, Tabelleninhalt fett und 12 pt. Kein physischer Druckertest.
- Keine Browser-Laufzeitfehler beobachtet. Bestehende TEST-Regressionsprüfungen bestanden; vorhandene Liste neutral, aktive Markierung nicht gespeichert oder umgeschaltet.

## Seitliche Anordnung: angehalten
Die reale Web-Liste hat die Abschnitte **Kopfdaten**, **Kontrollfelder** und **Berechnungen**; „Labor-Messungen“ ist ein Feld innerhalb der Berechnungen. Ein eigener Bereich **Auftragsdetails** existiert nicht.

Das gemeinsame Formular unterstützt bereits native Spalten, sodass eine lokale Darstellungsanordnung grundsätzlich ohne Datenbankänderung möglich ist. Die Zuordnung der vorhandenen Bereiche zu den gewünschten zwei Bereichen ist aber nicht eindeutig. Es wurden daher weder Felder herausgetrennt noch Kontrollfelder in Auftragsdetails umbenannt. Vorschlag zur Entscheidung: Kopfdaten links, Kontrollfelder und Berechnungen rechts, mit Stapelung bei schmalen Fenstern. Alternativ die genaue andere Ansicht benennen, wenn „Auftragsdetails“ die Auftragserstellung meint.

## Getrennte Abnahmen
- Web: Typografie und beide A4-Druckausgaben geprüft; seitliche Anordnung wartet auf fachliche Zuordnung.
- Desktop/Tauri und Firmen-Backend: nicht geprüft; die entscheidende Desktop-Abnahme bleibt offen.