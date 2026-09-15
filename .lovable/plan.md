# Lotnummer in der Gebindeübersicht korrigieren

## Analyseergebnis
- Die fachliche Lotnummer wird ausschließlich als `batch_number` der bestehenden Rohstoffcharge gespeichert.
- Manuelles Anlegen und Excel-Import erzeugen bzw. finden diese Charge korrekt und verknüpfen sie über die bestehenden Gebinde-Positionen.
- Ein Gebinde kann mehrere Lots enthalten; maßgeblich ist daher die bestehende FIFO-Zuordnung der Gebinde-Positionen. Der direkte Charge-Verweis am Gebinde dient nur als Kompatibilitätswert für ältere Daten.
- Die Detailansicht der Gebinde liest die Lotnummern bereits korrekt aus den FIFO-Positionen und fällt nur bei Altdaten auf den direkten Gebinde-Verweis zurück.
- Die fehlerhafte Übersicht ist die Gebinde-Scanansicht: Sie zeigt Rohstoff, Bestand, Charge und Lagerort gemeinsam, liest die Charge aber ausschließlich aus dem veraltbaren direkten Gebinde-Verweis. Die Rohstoff-Detailansicht verwendet bereits korrekt die FIFO-Positionen.
- Es gibt keine zweite fachliche Lotnummer. `manufacturer_batch` ist die separate Hersteller-/BigBag-Nummer und bleibt unverändert.

## Umsetzung
1. In der Gebinde-Scanansicht die bereits vorhandene Lotpositions-Anzeige wiederverwenden, die aktive FIFO-Positionen lädt.
2. Für reine Altdaten den dort bereits vorgesehenen direkten Charge-Verweis als Rückfall beibehalten.
3. Detailansicht, zentrale Abfragen, Lagerort-/Gebinde-, Lieferanten- und FIFO-Logik unverändert lassen.

## Prüfung
- Mehrere Lots in einem gescannten Gebinde werden vollständig und ohne Duplikate angezeigt.
- Aufgebrauchte Lotpositionen erscheinen nicht als aktueller Bestand.
- Altdaten ohne Position bleiben über den bestehenden Rückfall sichtbar.
- Bestehende Tests sowie eine Sichtprüfung der Scan- und Detailansicht bestätigen die Korrektur.

## Technische Grenzen
Keine neue Tabelle, Migration oder Datenkopie; keine Änderungen an Backend-Adresse, Storage, Funktionen, Authentifizierung oder Secrets.
