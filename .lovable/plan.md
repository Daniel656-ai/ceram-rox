# Auftragsnummer unmittelbar nach Erstellung anzeigen

## Analyseergebnis
- Die bestehende Datenbankfunktion `generate_order_number()` vergibt die Auftragsnummer bereits beim Einfügen des Auftrags, noch vor dem Speichern. Das aktuelle Backend enthält 44 Aufträge; alle 44 besitzen eine Auftragsnummer.
- Die Dienstleister-Übernahme erzeugt keine Auftragsnummer. Sie aktualisiert ausschließlich die Aufgaben-Zuordnung und stößt danach eine erneute Abfrage des Auftrags an.
- Nach der Auftragserstellung verwendet die Oberfläche zunächst das Rückgabeobjekt des Einfügevorgangs und wechselt direkt in die Detailansicht. Ein gezieltes Einlesen und Übernehmen des vollständig gespeicherten Auftrags fehlt. Die spätere Übernahme aktualisiert den Auftrag erneut und macht dadurch die bereits gespeicherte Nummer sichtbar.
- Auftraggeber- und Dienstleisteransicht zeigen dasselbe Feld `measurement_orders.order_number`; es gibt keine zweite Nummernquelle.

## Umsetzung
1. Nach Abschluss aller Speicherschritte den soeben erstellten Auftrag einmal über die bestehende zentrale Auftragsabfrage neu laden.
2. Den vollständig gespeicherten Datensatz einschließlich der bereits vergebenen `order_number` in den aktuellen Detailansicht-Zustand übernehmen, bevor zur Auftragsansicht gewechselt wird.
3. Keine Nummer clientseitig erzeugen und keine Nummern-, Status-, Übernahme- oder Datenbanklogik verändern.

## Prüfung
- Neuer Auftrag: Nummer ist direkt nach erfolgreichem Speichern in der Detailansicht sichtbar.
- Schließen/erneut öffnen: dieselbe gespeicherte Nummer bleibt bestehen.
- Dienstleister-Übernahme: Zuordnung aktualisiert sich, Nummer bleibt unverändert.
- Gemeinsame React-Oberfläche für Web und Desktop/Tauri prüfen.
- Gezielte Tests sowie bestehende Tests ausführen.

## Technische Details
- Änderung ausschließlich im bestehenden Erstellungsablauf und dessen Query-Zustand.
- Bestehende zentrale API-Funktionen aus `src/lib/api/` werden verwendet.
- Keine Migration, keine Datenänderung und keine Infrastrukturänderung.
