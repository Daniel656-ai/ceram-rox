# Automatisches Mundstück 293/1 (Raumgewicht / Wasseraufnahme / Schwindung)

## Vorab-Befund (nur gelesen)
- Im Web-Datenbestand gibt es das Formular „Extrusion“ (538327c6-…) und die Felder `ms_auswahl_1`, `mundstueck_ms_1`, `brennen_1` **nicht** – sie existieren nur in der Firmendatenbank.
- Die Leistungen „Raumgewicht“, „Wasseraufnahme“, „Schwindung“ existieren im Web.
- Im Programm gibt es bereits eine Regel-Logik, die beim Speichern des Auftrags läuft (Regel-Aktion „Dienstleistung auslösen“, idempotent, unterscheidet automatisch/manuell, entfernt nur unbearbeitete automatische Positionen). Die neue Regel folgt genau diesem Muster.

## Empfehlung: Umsetzung im Programm beim Speichern (kein Datenbank-Trigger)
Gründe:
- Keine Migration, keine Änderung an Tabellen, Funktionen oder Policies – Firmendatenbank braucht keinen DBA-Eingriff.
- Web und Desktop nutzen denselben Programmcode → wirkt in beiden nach Neubau.
- Ein Trigger müsste das Formular-JSON serverseitig umschreiben; das ist riskanter für bestehende Werte und schwer nachvollziehbar.
- Bestehende Aufträge bleiben unberührt; die Regel läuft nur, wenn ein Auftrag neu angelegt oder dessen Formular gespeichert wird.

## Ablauf
1. Neue reine Rechenfunktion `planMundstueck293(...)`:
   - Eingabe: gebuchte Leistungen, aktuelle Zeilen `ms_auswahl_1`, Zeilen `brennen_1`.
   - Raumgewicht/Wasseraufnahme gebucht (einmal gezählt): 1 Eintrag `ms="293_1"`, `laenge=200`, `anzahl = floor(Brenntemperaturen/2)+1` (keine → 1), `zweck="Raumgewicht / Wasseraufnahme"`.
   - Schwindung gebucht: 1 Eintrag `ms="293_1"`, `anzahl=3`, `laenge=150`, `zweck="Schwindung"`.
   - Automatische Einträge werden über `zweck` + Kennzeichen `auto=true` erkannt; vom Auftraggeber gewählte 293/1-Zeilen (ohne Kennzeichen) werden nie verändert/gelöscht.
   - Idempotent: vorhandener Auto-Eintrag gleichen Zwecks wird aktualisiert statt dupliziert; entfällt die Leistung, wird er entfernt.
2. `mundstueck_ms_1`: Zeilen werden über die **stabile Zeilenkennung** des Mundstücks zugeordnet, nicht über die Position – bereits eingetragene Parameter anderer Mundstücke verschieben sich nicht. Wird ein Auto-Eintrag entfernt, dessen Mundstück-Zeile bereits Werte enthält, bleibt diese Zeile erhalten und wird als „verwaist – bitte prüfen“ markiert (kein stiller Datenverlust).
3. Aufruf an den bestehenden Speicherstellen (Auftrag anlegen, Auftraggeber-Formular speichern), direkt neben der vorhandenen Regel-Auswertung.
4. Anzeige: Auto-Zeilen in der MS-Auswahl erhalten den Hinweis „automatisch – wegen gebuchter Leistung“ (Zweck sichtbar).
5. Leistungen werden über ihren Namen erkannt (keine festen IDs, da Web- und Firmen-IDs abweichen).

## Offene Punkte zur Bestätigung
- Darf der Auftraggeber automatische Einträge bearbeiten? Vorschlag: Anzahl/Länge gesperrt, sonst wie normale Zeile.
- Ist die Zeilenzuordnung MS-Auswahl → Mundstück MS in der Firmendatenbank über eine Zeilenkennung oder nur über die Reihenfolge gelöst? Falls nur Reihenfolge: Auto-Einträge werden immer **am Ende** angehängt, damit nichts verrutscht.
- Prüfung am echten Formular nur in der Desktop-/Firmenumgebung möglich (Web hat das Formular nicht).

## Technische Details
- Neu: `src/lib/rules/mundstueck293.ts` + Tests `src/lib/rules/__tests__/mundstueck293.test.ts` (Fälle: 0–4 Brenntemperaturen, beide Leistungen, Mehrfachbuchung, Entfernen, manuelle 293/1-Zeile unberührt, zweiter Lauf ohne Änderung, Werte in Mundstück MS bleiben).
- Anpassung: `src/pages/CreateOrderPage.tsx` und Speicherpfad der Auftraggeber-Vorgaben (`OrderRequesterSpecs.tsx`), Hinweis in der Repeater-Darstellung.
- Keine Migration, keine Backend-/Auth-/Storage-/Edge-Function-Änderung.
