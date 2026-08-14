# Ergebnislogik strikt trennen und absichern

## Ziel
Messdienstleister sehen jederzeit Eingabefelder, Berechnungen und berechnete Werte. Nur die Kennzeichnung „Offizielles Ergebnis“ entscheidet, welche ausgefüllten Felder bzw. ausgewerteten Berechnungen nach Abschluss in der Ergebnisdatenbank erscheinen.

## Umsetzung
1. **Berechnungen im Messdienstleisterformular sichtbar halten**
   - Die Rollenansicht „Messdienstleister“ bleibt allein für Layout und Feldberechtigungen zuständig.
   - Berechnungen werden unabhängig von `is_result`/„Offizielles Ergebnis“ ausgewertet und als kontrollierbarer Ergebnisbereich angezeigt.
   - Die offizielle Kennzeichnung wird aus sämtlicher Rendering-/Sichtbarkeitslogik herausgehalten.

2. **Offizielle Ergebnisse beim Speichern zuverlässig ermitteln**
   - Vor Entwurfs- und Abschlussspeicherung werden Feld- und Berechnungsdefinitionen vollständig geladen, statt auf eventuell noch nicht geladene UI-Metadaten zu vertrauen.
   - Lokale Berechnungen werden beim Speichern erneut aus den aktuellen Formularwerten ausgewertet; gespeichert wird der Zahlenwert, nicht Formeltext oder technische ID.
   - Für verknüpfte Formulare werden technische Schlüssel weiterhin eindeutig mit Formular-ID gespeichert, während `display_label` ausschließlich den fachlichen Feld-/Berechnungsnamen enthält.
   - `is_official` wird für normale Felder und Berechnungen ausschließlich aus deren gespeicherter `is_result === true`-Eigenschaft gesetzt.

3. **Bestehende Ergebnisse schützen**
   - Vorhandene offizielle Datensätze werden nicht mehr pauschal gelöscht oder auf „nicht offiziell“ zurückgesetzt, nur weil Metadaten oder ein berechneter Wert während eines Render-/Ladezyklus fehlen.
   - Entfernt werden nur Werte, die im aktuell bekannten Formular tatsächlich geleert wurden; unbekannte bzw. historische offizielle Werte bleiben erhalten.

4. **Ergebnisdatenbank konsistent halten**
   - Die Datenbankansicht filtert weiterhin ausschließlich auf gespeichertes `is_official = true`.
   - Spaltennamen verwenden `display_label`; technische Schlüssel bleiben reine interne Identifikatoren.
   - Numerische offizielle Berechnungen stehen Tabelle, Export und Diagrammen als echter Ergebniswert zur Verfügung.

## Validierung
- Automatisierter Test für drei Eingabewerte und `AVERAGE(...) = 0,36`, wobei nur die Berechnung offiziell ist.
- Test, dass alle Eingaben und die Berechnung im Messdienstleisterformular sichtbar bleiben.
- Test der Speicherung: genau eine offizielle Ergebniszeile mit Label „Porenvolumen (Mittelwert)“ und Wert `0,36`; keine Einzelmesswerte als Ergebnisspalten.
- Regressionstest, dass ein bereits gespeichertes offizielles Ergebnis bei fehlenden/verspäteten Metadaten nicht verloren geht.
