# Aufgabe 014: Darstellung der Aktivitätsmessung in der Ergebnisdatenbank

Stand: **Analyse mit echten Daten (Probe P260305, FG26_0330, Auftrag FG-260016), nichts umgesetzt.**
Grundlage: `tasks014-q3.csv (Export, inzwischen gelöscht)` (alle Werte) und `tasks014-q3-block.csv (Export, inzwischen gelöscht)` (vollständiger Aktivitätsmessblock).
Entschieden: K-Wert-Einheit „Nm/h“ (wie F1-Blatt) · N₂ in = Text „Rest“ · Formulare nur prüfen und melden, nicht ändern.

## 1. So sind die Daten wirklich gespeichert

Eine Messung (M260640) besteht aus **einfachen Feldern** und **einem Aktivitätsmessblock**. Alles ist (noch) „vorläufig“ (`is_official = false`).

**Einfache Felder** (je eine Zeile in `measurement_results`):
`av_1`, `av_2` = 41,38 m/h · `fr_1`, `fr_2` = 1,44 Nm^{3}/h · `anzahl_der_kanale_av1/2` = 8 · `zellenzahl_av1/2` = 64 · dazu ein leerer Platzhalter `aktivitaet`.

**Aktivitätsmessblock** (`…:aktivitatsmessblock`, `value` leer, die Daten stehen als JSON-Liste in `remarks`).
Jeder Eintrag der Liste ist **ein Katalysator** (hier 2: `kat_nr` = FG26_0330/1 und FG26_0330/2). Jeder Eintrag enthält:

| Teil | Inhalt (echte Schlüssel) |
|---|---|
| `gas_einstellungen` (Liste mit 1 Objekt) | `kat_nr`, `frfeucht` (1,44), `fr_trocken` (1,296), **Sollwerte der Anlage:** `h2o_anlage` (10), `no_anlage` (200), `nh3_anlage` (240), `o2_anlage` (10); dazu **Umrechnungsfaktoren** `…_umrechnung` (z. B. `no_umrechnung` 144, `n_2_umrechnung` 19,12 – nur Dosier-Hilfsfaktoren, teils `null`) |
| `temperatur_11` (Liste, eine Zeile je Temperaturstufe, hier 200/280/360 °C) | `temperatur_1`, `eta_nox`, `k_wert_kopie`, `av_messung`, **gemessene Gase:** `no_anzeige_in_1`/`no_anzeige_out_1`, `no2_in_1`/`no2_out_1`, `n2o_in_1`/`n2o_out_1`, `nh3_in_1`/`nh3_out_1` |

Plausibilitätsprüfung: η NOx 22,4 % = (199,8 − 155) / 199,8 ✔; K-Wert 10,5 = 41,38 · ln(1/(1 − 0,224)) ✔. Die Zeilenwerte sind also in sich stimmig.
**Nicht vorhanden** in diesen Daten: CO in/out, CO₂ in/out (keine Felder), N₂-Wert (nur `n_2_umrechnung`), Einheiten für die Gasfelder (im JSON stehen keine Einheiten).

## 2. Antworten auf die offenen Fragen

**Frage 3 – Wo stehen die Messbedingungen?**
- **Block 1 kommt aus dem Katalysator-Eintrag:** `gas_einstellungen` (Sollwerte H₂O/NO/NH₃/O₂ = `*_anlage`, FR = `frfeucht`) plus AV aus `av_messung` (steht in jeder Zeile des Katalysators, bei beiden 41,38).
- AV/FR kommen **auch** als einfache Felder (`av_1`/`av_2`, `fr_1`/`fr_2`), aber dort ohne Zuordnung zum Katalysator. Ich nehme die Werte **aus dem Katalysator-Eintrag** (eindeutig) und nutze die einfachen Felder nur als Ersatz, falls im Block nichts steht.
- **N₂ in** steht nirgends als Wert → fester Text „Rest“.
- **Bedeutung:** „NO in“ in Block 1 ist der **Sollwert der Anlage** (200 ppm); die tatsächlich **gemessenen** NO in/out je Temperatur stehen in Block 2 (199,8 / 155 …). Das sind zwei verschiedene Dinge, beides wird gezeigt.

**Frage 4 – Gilt das für alle Aktivitätsmessungen?**
Sicher gesagt: nur für diese eine Messung (Formular `a8bdb319-…`). Ob ältere Messungen andere Schlüssel haben, sehe ich erst mit den SQL-Abfragen 4 und 8 (`tasks/archiv/014-pruefung.sql`).
Deshalb: Die Erkennung läuft **nicht über den Messartnamen**, sondern über die **Struktur**: ein Block-Eintrag mit Liste `gas_einstellungen` und einer Liste mit `temperatur…`-Zeilen. Passt die Struktur nicht → heutige Darstellung. Schlüssel werden **nach Muster** erkannt (`<gas>[_anzeige]_(in|out)[_n]`, `temperatur…`, `eta_nox`, `k_wert…`, `*_anlage`), nicht über feste Namen wie `temperatur_11` (die Zahl ist je Formular verschieden).

## 3. Befunde zur heutigen Anzeige (an echten Daten bestätigt)

1. **Die Messbedingungen sind unsichtbar.** `gas_einstellungen` gilt wegen „einstellung“ im Namen als Konfiguration: alle 26 Konfigurationswerte dieser Messung erscheinen nur unter „Details“, nie in der Wertetabelle.
2. **Die Temperaturzeilen erscheinen, aber mit schlechten Namen:** „Eta nox“, „K wert kopie“, „Av messung“, „Temperatur 1“, **„No anzeige in 1“, „No2 in 1“, „N2o in 1“, „N2o out 1“, „Nh3 in 1“**. NO₂ und N₂O sind **nicht vertauscht** (Werte 0,5/0 bzw. 0,2/0,2 – plausibel), aber falsch geschrieben (Groß-/Kleinschreibung, keine Tiefstellung) und ohne Einheit.
3. **Mein Gasnamen-Fix (Branch `improve/gasnamen-in-out`, noch nicht gemergt) reicht für diese Daten NICHT:** Er erkennt `no2_in`, aber die echten Schlüssel enden auf **`_1`** (`no2_in_1`) bzw. haben **`anzeige`** (`no_anzeige_in_1`). Diese bleiben „No2 in 1“ usw. → vor dem Merge um diese Muster erweitern (siehe Abschnitt 6).
4. **Einheiten:** Die Gasfelder haben im JSON keine Einheit (sie müssten aus der Formulardefinition kommen – SQL 8 zeigt, ob dort eine hinterlegt ist). Die Einheit `Nm^{3}/h` steht als Auszeichnungstext und wird an manchen Stellen roh angezeigt statt als Nm³/h.
5. **NO₂/N₂O Zuordnung/Einheit im Formular:** Aus diesen Daten nicht prüfbar (Formular nur prüfen und melden → SQL 8 ausführen; ich ändere nichts).

## 4. Vorschlag zur Darstellung (je Katalysator, Probendetail und Ergebnisübersicht)

```
Aktivitätsmessung · M260640 · Katalysator FG26_0330/1                     [vorläufig]

Messbedingungen
┌──────────┬────────────┬────────┬─────────┬────────┬────────┬──────┐
│ AV       │ FR         │ NO in  │ NH₃ in  │ H₂O in │ O₂ in  │ N₂ in│
│ [m/h]    │ [Nm³/h]    │ [ppm]  │ [ppm]   │ [%]    │ [%]    │      │
├──────────┼────────────┼────────┼─────────┼────────┼────────┼──────┤
│ 41,38    │ 1,44       │ 200    │ 240     │ 10     │ 10     │ Rest │
└──────────┴────────────┴────────┴─────────┴────────┴────────┴──────┘

Ergebnisse je Temperatur
┌──────────┬────────┬────────────┬──────────────┬──────────────┬─────────────┬─────────────┐
│ Temp.    │ η NOx  │ K-Wert     │ NO           │ NH₃          │ NO₂         │ N₂O         │
│ [°C]     │ [%]    │ [Nm/h]     │ in / out     │ in / out     │ in / out    │ in / out    │
├──────────┼────────┼────────────┼──────────────┼──────────────┼─────────────┼─────────────┤
│ 200      │ 22,4   │ 10,5       │ 199,8 / 155  │ 241 / 189,4  │ 0,5 / 0     │ 0,2 / 0,2   │
│ 280      │ 57,8   │ 35,7       │ 199,4 / 84,1 │ 241,1 / 115,1│ 0,5 / 0     │ 0,2 / 0,2   │
│ 360      │ 71,0   │ 51,2       │ 199,8 / 58   │ 241,2 / 94,1 │ 0,4 / 0     │ 0,2 / 0,3   │
└──────────┴────────┴────────────┴──────────────┴──────────────┴─────────────┴─────────────┘
(danach das zweite Katalysator-Paar FG26_0330/2 mit eigenen Tabellen)
```

Festlegungen:
- **Block 1 (Messbedingungen), je Katalysator:** 1 AV = `av_messung` (Ersatz `av_n`) · 2 FR = `frfeucht` (Ersatz `fr_n`; **Frage: feucht oder trocken?**) · 3 NO in = `no_anlage` · 4 NH₃ in = `nh3_anlage` · 5 H₂O in = `h2o_anlage` · 6 O₂ in = `o2_anlage` · 7 N₂ in = Text „Rest“.
- **Block 2 (Ergebnisse je Temperatur):** Temperatur · η NOx · K-Wert (aus `k_wert_kopie`, Einheit „Nm/h“) · NO, NH₃, NO₂, N₂O, CO, CO₂ je als „in / out“ in **einer** Zelle. **Spalten ohne jeden Wert (hier CO, CO₂) werden ausgeblendet.**
- Nicht angezeigt (bleiben unter „Details“): die `*_umrechnung`-Faktoren, `fr_trocken_umrechnung` usw. Zusätzlich im Kopf: `kat_nr`.
- Mehrere Katalysatoren = mehrere Abschnitte untereinander (Titel = `kat_nr`).
- Vorläufig = grau (wie bisher), offiziell = normal. Zeilen/Spalten ohne Wert zeigen „–“.
- Einheiten: AV [m/h] und FR [Nm³/h] aus den Daten; **ppm bzw. % für die Gase sind nicht gespeichert** → feste Beschriftung (NO/NH₃/NO₂/N₂O/CO in ppm; H₂O/O₂/CO₂ in %) oder aus dem Formular (nach SQL 8). **Bitte bestätigen.**
- Excel (Auftragsexport): dieselben zwei Tabellen je Katalysator, Spalte „Status“ bleibt.
- Fallback: Erkennt die Ansicht die Struktur nicht, bleibt alles wie heute.

## 5. Offene Fragen (nur noch diese)

1. **FR:** Im F1-Blatt `frfeucht` (1,44) oder `fr_trocken` (1,296)? (Vorschlag: feucht, entspricht dem Feld „FR 1“.)
2. **Einheiten der Gase:** ppm für NO/NH₃/NO₂/N₂O/CO und % für H₂O/O₂/CO₂ – so richtig? (Oder soll ich sie aus dem Formular lesen, sobald SQL 8 vorliegt?)
3. **NO in (Block 1):** Sollwert der Anlage (`no_anlage` = 200) wie vorgeschlagen? Oder der Mittelwert der gemessenen NO-in-Werte?
4. Soll die Katalysator-Bezeichnung `kat_nr` (FG26_0330/1) als Titel erscheinen?

## 6. Nächste Schritte
1. **Gasnamen-Branch erweitern (vor dem Merge):** Muster `<gas>[_anzeige]_(in|out)[_Zahl]` erkennen (`no_anzeige_in_1`, `no2_in_1`, `n2o_out_1`, `nh3_in_1` → „NO in“, „NO₂ in“, „N₂O out“, „NH₃ in“; die Endziffer `_1` wird nicht angezeigt). Ohne das bleibt die Anzeige dieser Messung falsch. → Dein OK, dass ich das in `improve/gasnamen-in-out` nachziehe und nochmal durch den Reviewer laufen lasse?
2. SQL 4, 5, 8 im Dev-Studio ausführen (Einheiten und Formulardefinition, NO₂/N₂O melden – nichts ändern).
3. Danach die Darstellung als eigener Branch: Erkennung per Struktur, Ansicht Probendetail + Ergebnisübersicht, Excel; Tests, Reviewer, Vorschau, „Darf ich mergen?“.

## Nachtrag (20.11.2026)
- Umgesetzt und gemergt (`improve/aktivitaet-einheitlich`); Regel in `docs/gestaltungsregeln.md`, Abschnitt „Aktivitätsmessung“.
- Die Prüfung aller Aktivitätsmessungen (`tasks/archiv/014-alle-messungen.sql` / `.csv`) wurde **verworfen** – nicht mehr nötig.
