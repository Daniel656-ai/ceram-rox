# Roadmap

- [ ] m³-Liste: freigegebene Elementnummern, Chargenblock und gezielte Tabellenvergrößerung in Bildschirm, HTML und PDF implementieren
- [ ] m³-Liste: Berechnung/Speicherschutz/Markierung sowie beide Ausgaben isoliert prüfen, Web lesend prüfen ohne produktive Testdaten
- [ ] m³-Liste: tatsächliche Desktop-Druckabnahme — Firmenumgebung hier nicht zugänglich

- [x] Schritt 1: Entwurfsspeicherung, Wiederherstellung, URL, Dateihinweise und bestätigtes Speichern abgesichert; 38 relevante Tests vor Schritt 2 bestanden
- [x] Schritt 2: Drei Einstiege im bestehenden Entwurfsfenster; unabhängige Vorlagenübernahme mit Doppelpositionen, Eingabe-Allowlist und Stop bei uneindeutigen Vorgaben
- [x] Entwürfe/Vorlagen: authentifizierter Web-Ablauf mit isolierter Speicherung, Reload, zugänglicher Auftragsauswahl, Vorlage und Speichern/Schließen geprüft; keine produktiven Testdaten
- [ ] Entwürfe/Vorlagen: echte Web-Speicherabnahme eines umfangreichen Entwurfs und mehrfache Vorlagenverwendung — produktive Testschreibzugriffe untersagt; separate Abnahmeumgebung erforderlich
- [ ] Entwürfe/Vorlagen: kompilierte Desktop-Abnahme — Firmenumgebung nicht zugänglich; Windows-X wartet ohne native Änderung nicht garantiert

- [x] Freigegebene lokale Definitionreferenzen und Messblock → Temperatur-Repeater additiv implementieren; offizielle Ergebnisableitung unverändert
- [x] Referenzen, unabhängige Kontexte, JSON-Speicherung und Bestandsregressionen isoliert getestet; 781 Tests erfolgreich, Web-Renderer mit isolierten Browserwerten geprüft, keine produktiven Testdaten
- [ ] Echte Web-Speicherabnahme und Formular-Klonprüfung — nur ohne produktive Testschreibzugriffe möglich; isolierter JSON-Roundtrip geprüft
- [ ] Installierte Desktop-Abnahme der Verschachtelung — Firmenumgebung nicht zugänglich

- [x] F&E-Bereichsreihenfolge: Fertigungsunterlagen im Workflow nach Arbeitszeiten direkt vor Änderungsverlauf; bestehender F&E-/Kundenauftrag im Web geprüft, 727 Tests erfolgreich
- [ ] F&E-Bereichsreihenfolge: installierte Desktopansicht separat abnehmen — Firmenumgebung nicht zugänglich

- [x] Versuchsnummer: ausgefülltes bestehendes Formularfeld bei explizitem Anlegen/Speichern zusätzlich getrimmt in pp_experiment_number übernehmen; leere Werte erhalten bestehende Nummern, keine Nachbefüllung
- [x] Versuchsnummer: 720 Tests bestanden, Speicherung/Anzeige isoliert getestet; Web-Übersicht und bestehende Details lesend ohne Laufzeitfehler geprüft
- [ ] Versuchsnummer: echte Speicherabnahme Web/Desktop — keine produktiven Testdaten erlaubt, Firmenumgebung nicht zugänglich; späterer Auftraggeber-Formular-Editor im aktuellen Quellstand nicht vorhanden, gemeinsamer Speicherweg vorbereitet

- [x] Probenname-Spalte: bestehende lesbare Probenbeziehungen laden, UUID-dedupliziert direkt nach Auftragsnummer verlinken; Suche/Filter unverändert
- [x] Probenname-Spalte: isolierte Tests und Web-Navigation, Nummernsortierung, Auftragsartfilter sowie DE/EN geprüft
- [ ] Probenname-Spalte: Desktop-Build und Firmenabnahme — blockiert: WebKit-Systembibliothek fehlt, installierte Firmenumgebung nicht zugänglich; keine Infrastrukturänderung freigegeben

- [x] Pilot-Plant-Versuchsnummer: Gebäude-/Massetypfeld und Web-Abbildung geprüft; Stop-Regel ausgelöst
- [x] Pilot-Plant-Versuchsnummer: vorhandene Kennung in Übersicht, Ergebnisdatenbank und Details anzeigen; Suche/Sortierung konsistent halten
- [ ] Pilot-Plant-Versuchsnummer: neue Nummern erfassen/ableiten — blockiert: `massetyp` fehlt im Auftragslayout, Nummernteil nicht festgelegt, Dieselkathalle→Dieselkat-Fall nicht bestätigt; keine Definitions-/DB-Änderung ohne Klärung
- [x] Pilot-Plant-Versuchsnummer: 688 Tests erfolgreich; Web-Übersicht, Suche, Sortierung und Detailziel mit vorhandener Nummer geprüft; Ergebnisabfrage HTTP 200
- [ ] Pilot-Plant-Versuchsnummer: reale PP-Ergebnisanzeige im Web prüfen — keine offiziellen PP-Ergebnisse vorhanden
- [ ] Pilot-Plant-Versuchsnummer: Desktop-Abnahme — Firmenumgebung nicht zugänglich; gesonderte Nutzerprüfung erforderlich

- [x] Ergebnisdatenbank: sicher zugeordnete Nachkommastellen ausschließlich in der Matrix anzeigen
- [x] Präzisionstests und bestehende Regressionstests ausführen; Web mit vorhandenen Porenvolumen-Ergebnissen prüfen
- [ ] Web-Abnahme BET (1 Stelle) und weitere Präzisionen — keine entsprechenden offiziellen Ergebnisse im vorhandenen Datenbestand; keine Testdaten angelegt
- [ ] Desktop-Präzisionsanzeige prüfen — wartet auf Zugriff/Abnahme in der Firmenumgebung

- [x] Inspect m³ sources: linked release has project_id but no authoritative serial-number field; stop before display changes
- [ ] Apply display-only change and missing/long-serial tests — blocked until the authoritative serial-number source is identified
- [ ] Verify Web/Desktop — blocked until the serial-number source is identified and display change is approved by that clarification

- [x] Analyze shared scrolling in Projects and Results Database tables
- [x] Add synchronized, reachable top horizontal scrollbars without changing table behavior
- [x] Analyze DIL/STA selected-value labels
- [x] Add automatic label placement and drag fallback without changing chart data
- [x] Verify both tables, both chart types, and desktop-equivalent shared code

- [x] Mundstück 293/1 automatisch bei Raumgewicht/Wasseraufnahme/Schwindung (Programm, keine Migration)
- [ ] Prüfung in der Firmenumgebung mit Testauftrag — wartet auf den Nutzer (Formular nur dort vorhanden)
- [ ] m³-Liste: vollständige Analyse und Umsetzungskonzept (nur lesen) — als Nächstes
- [x] Proben-Laufzettel mit DMC (Web geprüft); offen: Desktop-Druckprüfung, Scan mit Handscanner auf Papier
- [x] Auftrags-Laufzettel + Tabellenwerte im Proben-Laufzettel (Web geprüft); offen: Desktop-Druck, Papier-Scan
