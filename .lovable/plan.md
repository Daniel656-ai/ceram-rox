# Robuste Befüllung der m³-Vorlage

## Ziel
Die bestehende Vorlage „m³-Liste“ bleibt dieselbe. Fehlende Bestandteile der definierten m³-Struktur werden ergänzt, ohne vorhandene Felder oder Benutzeranpassungen zu verändern.

## Umsetzung
- Die vorhandene Vorlage weiterhin ausschließlich über ihren normalisierten Namen finden; keine zweite Vorlage anlegen, wenn sie existiert.
- Die erwarteten technischen Schlüssel einzeln mit den vorhandenen Feldern vergleichen statt nur die Gesamtanzahl zu prüfen.
- Nur fehlende Kopfdaten-, Kontroll-, Berechnungs- und Bestätigungsfelder anlegen.
- Den Repeater `m3_rows` gezielt finden oder ergänzen; seine vier fehlenden Unterfelder ausschließlich unter diesem Repeater ergänzen.
- Vorhandene Labels, Positionen, Konfigurationen, Metadaten und Layouts unverändert lassen.
- Jeden fehlgeschlagenen Insert mit Vorlagen-ID, technischem Feldschlüssel und konkreter Backend-Fehlermeldung protokollieren und weiterwerfen. Ein späterer Aufruf setzt anhand der noch fehlenden Schlüssel fort.
- Beim Öffnen einer m³-Liste die Formularbefüllung unabhängig von der Konstantenprüfung ausführen. Fehlende Konstanten sperren weiterhin nur Berechnungen.
- Fehler der Vorlagenbefüllung in der m³-Liste sichtbar anzeigen, statt eine leere Darstellung ohne Ursache zu zeigen.

## Prüfung
- Automatisierte Tests für leere, teilweise befüllte und vollständige Vorlagen ergänzen.
- Sicherstellen, dass bei einer vollständigen Vorlage kein Insert erfolgt und vorhandene Benutzeränderungen unangetastet bleiben.
- Sicherstellen, dass ein abgebrochener Teil-Seed beim nächsten Aufruf nur fehlende Elemente ergänzt.
- Relevante Tests und Typprüfung ausführen.
- Den Desktop-Datenbestand selbst nur prüfen, soweit er aus dieser Umgebung erreichbar ist; andernfalls den Laufzeittest als nicht direkt ausführbar kennzeichnen.

## Unverändert
Keine Änderungen an Formeln, anderen Formularen, Synchronisation, Datenbankstruktur, Backend-Adresse, Auth, Storage, Edge Functions, Fertigungsfreigaben, Revisionen, Aufträgen oder `order_id`.
