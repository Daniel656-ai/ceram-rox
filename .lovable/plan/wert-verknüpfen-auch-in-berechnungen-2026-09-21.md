# „Wert verknüpfen" auch in Berechnungen

## Befund (vor der Änderung)

**Wo „Wert verknüpfen" heute liegt**
- Feldeditor des Formulardesigners: `src/components/ServiceDesigner/FieldEditDialog.tsx`, Abschnitt „Wertquelle" (Zeilen ~338–392). Auswahl: „Eigene Eingabe", „Feld aus diesem Formular", „Wert aus verknüpftem Formular" (Quellformular + Quellfeld, inkl. dort definierter Berechnungen).
- Datenmodell: genau eine Struktur – `form_fields.data_source` (`src/lib/fieldLinks.ts`: `readValueSource`, `resolveLinkedValue`). Keine zusätzliche Tabelle.
- Auflösung zur Laufzeit: `FormLayoutRenderer.tsx` → `LinkedFieldControl` (Zeile ~938). Der Quellwert wird dort in den eigenen Feldschlüssel gespiegelt.

**Warum das in Berechnungen derzeit nicht auswählbar ist**
1. Der Berechnungsdialog (`LocalCalculationsPanel.tsx`) bietet als Operanden nur Felder **dieses** Formulars an (`localFields`, `linkedFields`, Konstanten, andere Berechnungen). Eine Verknüpfung auf ein Feld eines anderen Formulars (T1–T6 aus den Auftraggeber-Vorgaben) lässt sich dort nicht anlegen – sie muss heute umständlich vorher als eigenes Feld im Formular angelegt werden.
2. Selbst dann gilt: Der verknüpfte Wert entsteht erst, wenn das Feld im Layout **sichtbar gerendert** wird. Ein nur für die Berechnung angelegtes Feld ohne Platzierung bleibt leer.

## Minimale Änderung

1. **Neue Hilfsfunktion** `linkedFieldScope(fields, { formValues, stepData, formData })` in `src/lib/fieldLinks.ts`: liefert für alle Felder mit `data_source` den aufgelösten Wert unter ihrem Feldschlüssel – dieselbe bestehende Mechanik (`resolveLinkedValue`), nur unabhängig vom Rendern.
2. **Einbindung** in `FormLayoutRenderer.tsx` genau an einer Stelle: im Wertebereich der Berechnungsauswertung (`calcResults`, ~Z. 2090) werden diese Werte den Formularwerten untergelegt (bereits vorhandene Werte gewinnen, damit sich nichts am bisherigen Verhalten ändert).
3. **Auswahl im Berechnungsdialog** (`LocalCalculationsPanel.tsx`): im Operanden-Dropdown eine zusätzliche Option „Wert verknüpfen …". Sie öffnet eine kleine Auswahl „Formular → Feld" (dieselbe Auswahl-Logik wie im Feldeditor) und legt über die bestehende Feld-API ein verknüpftes, schreibgeschütztes Feld in diesem Formular an (`data_source` = `linked_form`). Dessen Feldschlüssel wird als Parameter der Berechnung eingesetzt und erscheint anschließend wie bisher in der Gruppe „Verknüpfte Felder".

Damit entsteht keine zweite Verknüpfungslogik: Speicherung, Auflösung und Anzeige bleiben die bestehende `data_source`-Mechanik.

## Nicht berührt

Datenbank, Backend, Auth, Edge Functions, Auftragsworkflow, bestehende Formeln (η NOx, K-Wert bleiben unverändert), bestehende Felder und Layouts.

## Test

- Neue Tests in `src/test/` : Auflösung von T1–T6 aus einem verknüpften Formular in einer Berechnung; kein Ersatzwert 0, wenn die Quelle leer ist; bestehende Berechnungen unverändert.
- Gesamte Testsuite (aktuell 391) muss grün bleiben.
- Praxisprüfung in der Web-Vorschau; Desktop nutzt denselben Code (keine plattformspezifische Logik in diesen Dateien).
