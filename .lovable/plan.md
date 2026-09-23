# Knetung: Rezeptur mit Abschnittswechsel (Zugabefolge)

## Befund der bestehenden Implementierung

**Rohstoffvorgabe / Knetdauer [h]**
Beides sind normale Formularfelder der Dienstleistung, im Formulardesigner konfiguriert (Feldtyp „Rezeptur / Rohstoffliste (Auftraggeber)" bzw. Zahl). Sie liegen als Konfiguration im Firmen-Datenbestand, nicht im Code. Im Code existiert nur der Feldtyp `raw_material_recipe` (`src/lib/formFieldTypes.ts`, `src/lib/api/formFields.ts`).

**Rezeptur / Rohstoffliste → Rohstoff hinzufügen**
Eine einzige Komponente: `src/components/RawMaterialRecipeField.tsx`.
- Wert = flache Liste von Zeilen `{ raw_material_id, quantity, unit, note }`, gespeichert als JSON im Formularwert. Reihenfolge = Array-Reihenfolge.
- Rohstoffauswahl ausschließlich aus der bestehenden Rohstoffverwaltung (`api.rawMaterials.list`), plus Verfügbarkeitsprüfung über Gebinde.
- Sortierung per Drag & Drop (dnd-kit).
- Eingebunden an drei Stellen, alle mit demselben Vertrag `value/onChange/readonly`: `ServiceBookingForm.tsx` (Auftraggeber), `ServiceDesigner/FormLayoutRenderer.tsx`, `workflow/ProcessRuntimePanel.tsx`.

**Die „freie Zeile"**
Es gibt dafür keine eigene Logik. Eine Zeile ohne ausgewählten Rohstoff (`raw_material_id: ""`) wird einfach mitgespeichert und leer dargestellt — sie hat heute rein optische Bedeutung als Trenner. Kein Feld für eine Zugabezeit.

**Abschluss → Fotodokumentation**
`src/components/order/PhotoDocumentationCard.tsx` liest alle Ergebniszeilen des Auftrags und zeigt ausschließlich Bildeinträge. Rezepturen erscheinen dort nicht inhaltlich; die Bezeichnung „Rezeptvorgabe" taucht nur als Gruppen-/Schrittname auf. Eine Unterscheidung Vorgabe ↔ Ergebnis existiert bisher nicht.

## Datenmodell — keine Änderung nötig

Der Feldwert ist bereits freies JSON. Abschnitte lassen sich additiv im selben Array abbilden, indem neben Rohstoffzeilen ein zweiter Eintragstyp erlaubt wird:

```text
[ {kind:"section", label:"Teilprozessschritt 1", offset_minutes:0},
  {raw_material_id:…, quantity:…, unit:…, note:…},
  {raw_material_id:…, …},
  {kind:"section", label:"Teilprozessschritt 2", offset_minutes:30},
  {raw_material_id:…, …} ]
```

Vorteile: Reihenfolge von Abschnitten und Rohstoffen bleibt erhalten, bestehende Werte ohne Abschnitte bleiben unverändert lesbar (sie gelten als ein einziger impliziter Abschnitt), keine Migration, keine Tabellen-, Backend- oder Storage-Änderung.

## Geplante Änderungen

1. **`src/lib/recipeSections.ts` (neu, klein)** — Typen und Hilfsfunktionen: Erkennen eines Abschnittseintrags, Gruppieren der flachen Liste in Abschnitte, Zurückschreiben in die flache Liste, Einfügen/Entfernen eines Abschnitts. Rein lesend/umformend, keine Backend-Berührung.

2. **`src/components/RawMaterialRecipeField.tsx` (erweitern, nicht ersetzen)**
   - Darstellung gruppiert nach Abschnitten mit Kopfzeile „Teilprozessschritt N" und Eingabefeld „Zugabezeit [min]".
   - Bestehender Button „Rohstoff hinzufügen" bleibt, fügt in den jeweils letzten/aktiven Abschnitt ein.
   - Neuer Button „+ Abschnittswechsel".
   - Drag & Drop, Rohstoffauswahl, Mengen, Einheiten, Verfügbarkeits- und Fehlmengenprüfung bleiben unverändert.
   - Ohne Abschnitte verhält sich das Feld exakt wie heute.

3. **`src/hooks/useReportFieldCatalog.ts`** — Unterfelder des Rezepturfeldes um `section` und `offset_minutes` ergänzen, damit Berichte die Zugabefolge ausgeben können.

4. **Ergebnisdarstellung Abschluss** — Rezepturwerte strukturiert darstellen, getrennt in „Vorgabe (aus dem Auftrag)" und „Ergebnis (erfasste Zugabefolge)", anhand der bestehenden Rollenansicht des Feldes (Auftraggeber- vs. Ergebnisansicht). Umfang hängt davon ab, wo die Knetungs-Rezeptur beim Abschluss angezeigt werden soll — siehe Rückfrage unten.

5. **Tests** — `src/test/recipeSections.test.ts`: Altwerte ohne Abschnitte, Gruppierung, Reihenfolgeerhalt, Hin- und Rückumwandlung.

## Rückfrage vor Punkt 4

Soll die erfasste Zugabefolge im Tab „Abschluss" als eigene Karte „Rezeptur / Zugabefolge" neben der Fotodokumentation erscheinen (Vorgabe und Ergebnis nebeneinander), oder genügt die strukturierte Darstellung innerhalb der bestehenden Ergebnisformulare?

## Nicht angefasst

Rohstoffverwaltung und -stammdaten, Rohstoffauswahl-Logik, Formulardesigner-Feldtypen, Datenbank, Migrationen, Auth, Storage, Edge Functions, Pilot-Plant-Prozessbausteine.
