# Gestaltungsregeln

Verbindliche Vorgaben für die Darstellung. Sie gelten auch für künftige Formularversionen: Wird ein Formular geändert
oder neu angelegt, bleibt die Darstellung gleich – neue Feldnamen werden in die Zuordnung aufgenommen, nicht in eine
neue Ansicht.

## Aktivitätsmessung

Gilt in der Ergebnisdatenbank überall: **Probendetail, Ergebnisübersicht (Seitenleiste) und Auftrags-Excel**.
Umsetzung: `src/lib/results/activityMeasurement.ts` (Zuordnung), `src/components/results/ActivityMeasurementView.tsx`
(Ansicht), `src/lib/orderExport/buildOrderExport.ts` (`activityExportRows`).

1. **Immer unsere Ansicht.** Jede Aktivitätsmessung wird in dieser Ansicht dargestellt – egal welche Formularversion
   (Block, flach je Temperaturstufe, alt flach). Es gibt **keinen Rückfall** auf die alte flache Tabelle und keine
   Resttabelle oben.
2. **Erkennung** über die Messart „Aktivitätsmessung“ **und** die Struktur (Feldschlüssel nach Mustern, nie feste
   Namen mit Nummern). Passt nur die Messart, gilt trotzdem unsere Ansicht (fehlende Bereiche mit Hinweis).
   Ohne jeden Wert: nur eine kurze Zeile „keine Messwerte erfasst“.
3. **Reihenfolge**
   1. *Kopf:* Probe – Bezeichnung groß, Nummer klein. Nur bei echter Katalysatornummer (z. B. `FG26_0330/1`) zusätzlich
      „Katalysator …“. Ist die Katalysatorbezeichnung gleich der Probenbezeichnung, entfällt diese Zeile.
   2. *Probendaten:* Test-Nr, Kanalgröße d, Wandstärke ti, Länge l, Anzahl Kanäle, Zellenzahl – was vorhanden ist.
   3. *Messbedingungen:* AV [m/h], FR [Nm³/h] (feucht), NO in [ppm], NH₃ in [ppm], H₂O in [%], O₂ in [%],
      N₂ in = „Rest“. Gase/Einheiten fest (ppm bzw. %). `*_anlage` zählt nur mit Einheit ppm/% als Sollwert;
      Nml/g/Nl sind Dosiermengen → „Weitere Angaben“.
   4. *Ergebnisse je Temperatur:* Temperatur [°C], η NOx [%], **ein** K-Wert [Nm/h] (`k_wert_kopie`, sonst `k_wert`),
      dann NO, NH₃, NO₂, N₂O, CO, CO₂ jeweils „in / out“ in einer Zelle. Spalten ohne Werte entfallen.
   5. *Weitere Angaben:* klein am Ende – alles, was nicht zuordenbar ist. **Nichts geht verloren.**
4. **Fehlende Werte** zeigen „–“; fehlende Bereiche einen kurzen Hinweis („keine Messbedingungen erfasst“,
   „keine Ergebnisse je Temperatur erfasst“).
5. **Vorläufig/offiziell:** vorläufige Werte grau, offizielle normal (wie überall in der Ergebnisdatenbank).
6. **Zuordnung nach Nummern:** Katalysator n = Endung `/n` der `kat_nr`, sonst Nummer im Feldnamen (`av_2`, `…_av2`,
   `_kopie` = 2) bzw. Position. Felder ohne Nummer gehören zu allen Katalysatoren.
7. **Beschriftungen:** Gasnamen mit Richtung „NO₂ in“, „N₂O out“ (Endziffer `_1` wird nicht angezeigt);
   Einheiten und Auszeichnungen lesbar (`Nm^{3}/h` → Nm³/h, `Zellenzahl_{ (AV2)}` → Zellenzahl (AV2)).
8. **Neue Formularversion:** zuerst Feldnamen prüfen (`scripts/analyse/aktivitaet-varianten.sql`), dann die Zuordnung in
   `activityMeasurement.ts` ergänzen und einen Test mit den echten Feldnamen anlegen. Die Ansicht selbst bleibt unverändert.

## BET

Gilt in der Ergebnisdatenbank überall: **Auftragsansicht (Seitenleiste), Probendetail, Ergebnismatrix, Zähler und Excel**
(Auftrags-Excel und Export der Ergebnisdatenbank). Umsetzung: `src/lib/results/betMeasurement.ts` (Erkennung,
`displayResults`), `src/components/results/BetResultsTable.tsx` (Ansicht).

1. **Nur das Ergebnis.** BET zeigt ausschließlich „Spezifische Oberfläche BET“ in **m²/g** – je Probe eine Zeile
   (**Probe | BET [m²/g]**). Vorläufig grau, offiziell normal.
2. **Keine Hilfswerte.** Tara, Brutto, Probengewicht (Netto), Rohr-Nr., SMP-Nummer und die Importinfo
   („Messdatenimport“) werden nicht angezeigt. Sie bleiben **in der Datenbank gespeichert – nichts wird gelöscht**.
3. **Erkennung über Messart + Feldzuordnung** (nicht nur über die Beschriftung): Messart „BET“ bzw. „Spezifische
   Oberfläche“ und das Ergebnisfeld (Schlüssel `spezifische_oberflache_bet`, Beschriftung mit „Oberfläche … BET“ oder
   ein `*bet*`-Feld mit Einheit m²/g). Dadurch passt es auch bei anderen Formularversionen.
4. **Sicherheitsnetz:** Findet sich in einer BET-Messung kein BET-Ergebnisfeld, bleibt alles sichtbar (nichts geht verloren).
5. **Zähler** (offiziell/vorläufig) zählen bei BET nur den BET-Wert.
6. **Neue Formularversion:** zuerst Feldnamen prüfen (BET-Abfrage analog `scripts/analyse/aktivitaet-varianten.sql`), dann
   die Erkennung in `betMeasurement.ts` ergänzen und einen Test mit den echten Feldnamen anlegen.
