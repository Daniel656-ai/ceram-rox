# Lotnummer in der Rohstoffübersicht korrigieren

## Analyseergebnis
- Die fachliche Lotnummer wird ausschließlich als `batch_number` der bestehenden Rohstoffcharge gespeichert.
- Manuelles Anlegen und Excel-Import erzeugen bzw. finden diese Charge korrekt und verknüpfen sie über die bestehenden Gebinde-Positionen.
- Ein Gebinde kann mehrere Lots enthalten; maßgeblich ist daher die bestehende FIFO-Zuordnung der Gebinde-Positionen. Der direkte Charge-Verweis am Gebinde dient nur als Kompatibilitätswert für ältere Daten.
- Die Detailansicht der Gebinde liest die Lotnummern bereits korrekt aus den FIFO-Positionen und fällt nur bei Altdaten auf den direkten Gebinde-Verweis zurück.
- Die Rohstoffübersicht lädt zwar Gebinde und Lagerorte, aber nicht deren FIFO-Lotpositionen. Deshalb kann sie die tatsächlich zugehörigen Lotnummern nicht konsistent aus derselben Gebinde-Datenquelle darstellen.
- Es gibt keine zweite fachliche Lotnummer. `manufacturer_batch` ist die separate Hersteller-/BigBag-Nummer und bleibt unverändert.

## Umsetzung
1. Die vorhandene zentrale Gebinde-Abfrage additiv um die bereits bestehende Beziehung zu den FIFO-Lotpositionen und deren Charge erweitern.
2. In der Rohstoffübersicht die aktiven Lotnummern je Rohstoff aus genau diesen Gebinde-Positionen aggregieren; für reine Altdaten den bereits vorhandenen direkten Charge-Verweis als Rückfall verwenden.
3. Die Lotnummer-Spalte und Suche der Rohstoffübersicht auf diese aggregierte Quelle ausrichten.
4. Detailansicht, Lagerort-/Gebinde-, Lieferanten- und FIFO-Logik unverändert lassen.

## Prüfung
- Mehrere Lots in einem Gebinde werden vollständig und ohne Duplikate angezeigt.
- Aufgebrauchte Lotpositionen erscheinen nicht als aktueller Bestand.
- Altdaten ohne Position bleiben über den bestehenden Rückfall sichtbar.
- Bestehende Tests sowie eine Sichtprüfung der Übersicht und Detailansicht bestätigen die Korrektur.

## Technische Grenzen
Keine neue Tabelle, Migration oder Datenkopie; keine Änderungen an Backend-Adresse, Storage, Funktionen, Authentifizierung oder Secrets.
