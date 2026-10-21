# Roadmap

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
