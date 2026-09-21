# UX-Erweiterung: Tabellen-Scrollleisten und Diagrammwerte

## Ziel
Zwei rein visuelle Verbesserungen, ohne Änderungen an Daten, Abfragen, Berechnungen, Berechtigungen oder Backend:

1. Jede horizontal überbreite ROX-Tabelle erhält automatisch eine obere, mit der vorhandenen unteren Leiste synchronisierte Scrollleiste.
2. Eingeblendete Einzelwerte in den gemeinsam genutzten Kurvendiagrammen werden kollisionsärmer positioniert und bleiben verschiebbar.

## Umsetzung

### Tabellen
- Die vorhandene Synchronisationslösung in einen gemeinsamen Scroll-Container integrieren.
- Die zentrale ROX-Tabellenkomponente damit ausstatten, sodass alle darauf basierenden Tabellen automatisch profitieren.
- Bereits separat angebundene Tabellen auf denselben Container umstellen und doppelte obere Leisten vermeiden.
- Die wenigen breiten Tabellen mit eigenem HTML-Aufbau ebenfalls nur am bestehenden Überlauf-Container anbinden.
- Die obere Leiste nur bei tatsächlichem horizontalem Überlauf anzeigen und innerhalb des sichtbaren Tabellenbereichs oben festhalten.
- Filter, Sortierung, Seitenwechsel, Tabellenköpfe, Zeilen und Inhalte unverändert lassen.

### Diagramme
- Die vorhandene gemeinsame Kurvenanzeige und verschiebbare Wertebeschriftung weiterverwenden.
- Die automatische Platzwahl um Kollisionsprüfung gegen Kurven, andere markierte Punkte und bereits platzierte Beschriftungen erweitern.
- Bevorzugt oberhalb platzieren, bei Konflikten alternative Seiten wählen und Randabstände einhalten.
- Drag & Drop und die dezente Führungslinie beibehalten; nur die Beschriftungsposition ändern, niemals Kurven oder Messwerte.
- Dadurch profitieren DIL, STA und alle weiteren Ansichten, die dieselbe Kurvenkomponente verwenden.

## Technische Details
- Keine Datenbank-, Backend-, Auth-, Storage-, Infrastruktur- oder API-Änderungen.
- Gemeinsame UI-Bausteine statt einer neuen Tabellen- oder Diagrammarchitektur.
- Automatische Breitenmessung bleibt dynamisch, einschließlich Größen- und Inhaltsänderungen.
- Diagrammpositionen werden ausschließlich aus den bereits gerenderten Punkt- und Kurvenkoordinaten ermittelt.

## Prüfung
- Mehrere breite Tabellen aus unterschiedlichen Bereichen: obere und untere Leiste in beide Richtungen synchron; obere Leiste nach vertikalem Scrollen erreichbar.
- Schmale Tabelle: keine zusätzliche Leiste.
- DIL und STA: Punktwert automatisch ohne ungünstige Überdeckung, auch an allen Diagrammrändern.
- Mehrere Punktwerte: gegenseitige Überdeckung möglichst vermeiden.
- Beschriftung per Drag & Drop verschieben; Führungslinie und Begrenzung auf die Zeichenfläche prüfen.
- Sicherstellen, dass Daten, Kurven, Achsen und Berechnungen unverändert bleiben.
- Web im laufenden ROX-Preview prüfen; Desktop verwendet denselben Frontend-Code, ohne desktop-spezifische Daten- oder Verbindungsänderung.
