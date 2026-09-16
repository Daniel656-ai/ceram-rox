# Rohstoffverwaltung: Gebinde-ID, LOT-Anzeige und MRS-Nummer

## Analyseergebnis (Ist-Zustand)

- **Gebinde-ID** wird serverseitig beim Anlegen erzeugt (Datenbank-Auslöser auf der Gebindetabelle). Muster heute: `GEB-<LOT-Nummer>-NNN`, ohne LOT `GEB-FREI-NNNN`. Die LOT-Nummer fließt also direkt in die Gebinde-ID ein – genau das soll entfallen.
- **Verknüpfungen** zwischen Gebinden, Buchungen, Bewegungen, Etikettendrucken, Knetungen usw. laufen ausschließlich über die interne Datensatz-Kennung, **nicht** über die Gebinde-ID als Text. Die Gebinde-ID erscheint nur als Anzeige, im Etikett und als Suchbegriff beim Scannen (dort neben dem Barcode).
- Bestand aktuell: 6 Gebinde, 12 LOTs. Bereits gedruckte Etiketten und Historieneinträge enthalten die alte Gebinde-ID als Momentaufnahme.
- **LOT-Nummer** liegt ausschließlich in der LOT-Tabelle (`batch_number`); Mehrfach-LOTs pro Gebinde über die bestehenden FIFO-Positionen. Bleibt unverändert.
- **MRS-Nummer** liegt heute am **Rohstoff** (ein Feld pro Rohstoff, 7 Rohstoffe befüllt). Am LOT existiert kein MRS-Feld. Für die gewünschte Logik ist deshalb eine kleine, additive Datenbankänderung nötig.

## Notwendige Datenbankänderung (additiv, reversibel)

1. **Neues optionales Feld `mrs_number` an der LOT-Tabelle** (leer erlaubt). Zusätzlich ein eindeutiger Index, der dieselbe MRS-Nummer nicht zweimal vergeben lässt (leere Werte bleiben unbegrenzt möglich).
2. **Vergabelogik der Gebinde-ID ersetzen**: fortlaufend `GEB-001`, `GEB-002`, … über alle Gebinde hinweg, unabhängig von Rohstoff und LOT, kollisionsfrei über die bestehende Sperrtechnik, dreistellig aufgefüllt und ab 1000 automatisch vierstellig. Manuell eingegebene IDs bleiben weiterhin erlaubt.
3. **Nichts wird gelöscht**: Das bisherige MRS-Feld am Rohstoff und das Feld „Ursprüngliche Menge" am Gebinde bleiben in der Datenbank erhalten (Historie, Warnlogik bei Buchungen). Sie verschwinden nur aus der Bedienoberfläche.

**Auswirkungen:** Neue Gebinde erhalten ab sofort `GEB-001` ff. (die Zählung startet bei 1, da noch keine Gebinde im neuen Format existieren). Bestehende Gebinde behalten ihre alte ID, damit gedruckte Etiketten, Barcodes und Historien gültig bleiben. Eine spätere Umnummerierung der 6 Altbestände ist jederzeit möglich, wird hier aber bewusst nicht durchgeführt.

**Übernahme der bisherigen MRS-Nummern:** Für Rohstoffe mit genau einem LOT wird die vorhandene MRS-Nummer einmalig auf dieses LOT übertragen. Bei mehreren LOTs bleibt die Zuordnung leer und wird manuell gesetzt – eine automatische Verteilung wäre fachlich geraten.

## Änderungen in der Oberfläche

- **Reiter „Gebinde"**: LOT-Spalte zeigt nur noch die LOT-Nummern ohne Menge; Bestandsspalte zeigt nur noch den aktuellen Bestand (keine Ursprungsmenge mehr). Aufgeklappte LOT-Detailansicht mit Zugangs- und Restmenge bleibt unverändert.
- **Dialog „Gebinde bearbeiten"**: Feld „Ursprüngliche Menge" entfällt. Beim Neuanlegen wird der eingegebene Bestand zugleich als Ursprungsmenge gespeichert (intern, unsichtbar); beim Bearbeiten bleibt der gespeicherte Wert unverändert. Platzhaltertext der Gebinde-ID wird auf „Auto: GEB-NNN" geändert.
- **Reiter „LOT/Chargen"**: neue Spalte **MRS-Nummer**, direkt in der Zeile bearbeitbar (leer = nicht beprobt), analog zu den bestehenden Feldern Feuchte und pH-Wert. Doppelte MRS-Nummern werden mit verständlicher Meldung abgelehnt.
- **Rohstoff-Kopf und Rohstoff-Bearbeiten**: MRS-Feld auf Rohstoffebene entfällt aus der Bedienung; Suche berücksichtigt künftig die MRS-Nummern der LOTs.
- **Etiketten**: bestehendes Feld „MRS-Nummer" bleibt funktionsfähig; wo ein LOT bekannt ist, wird dessen MRS-Nummer bevorzugt.

## Nicht verändert

Bestandsberechnung, FIFO-Logik im Gebinde, Lagerort- und Lieferantenverknüpfung, Wareneingangs- und Verbrauchsbuchungen, Import, Etikettendruck-Historie, Rollen/Berechtigungen, Backend-Adresse, Speicher, Serverfunktionen, Zugangsdaten.

## Prüfung

Neues Gebinde erhält `GEB-001`/fortlaufend ohne LOT-Anteil; LOT-Wechsel ändert die Gebinde-ID nicht; mehrere LOTs eines Rohstoffs mit unterschiedlichen oder leeren MRS-Nummern; Gebindeübersicht ohne Mengenangabe an der LOT-Nummer und ohne Ursprungsmenge; Bearbeitungsdialog ohne dieses Feld; bestehende Gebinde weiter öffnen-, buchen- und druckbar. Web und Desktop nutzen dieselbe Oberfläche, Prüfung gilt für beide.
