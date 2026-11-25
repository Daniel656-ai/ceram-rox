# 008 – Ergebnismatrix übersichtlicher machen (Analyse & Vorschläge)

> Reine Analyse. Es wurde **kein Code geändert**, kein Arbeitszweig angelegt, nichts committet.
>
> Grundlage: der Programmcode (`ResultsMatrixTable.tsx`, `resultSchema.ts`, `ResultsDatabasePage.tsx`)
> und deine Beobachtungen. Ich habe die Seite nicht mit echten Daten gesehen. Aussagen darüber, was
> in welcher Spalte landet, sind deshalb Schlussfolgerungen aus dem Code (siehe Abschnitt 1.4).

---

## 1. Wie die Ergebnismatrix heute aufgebaut ist

### 1.1 Wofür sie gedacht ist

Die Matrix ist die „Excel-Sicht“ der Ergebnisdatenbank: **eine Analyse (Messung) = eine Zeile,
ein Ergebnisparameter = eine Spalte**. Sie soll alle **offiziellen** Ergebnisse auf einen Blick
nebeneinander zeigen – Werte, die nur vorläufig oder intern sind, erscheinen hier nie
(die stehen nur in der Probenübersicht).

### 1.2 Aufbau auf dem Bildschirm

```
┌ Ergebnismatrix ─────────────────────────────── [Angezeigte Parameter (39/39)] ┐
│ Erklärtext (Spaltenstruktur bleibt bei Filtern stabil …)                       │
├───────────────────────────────────────────┬───────────────────────────────────┤
│ FIX (bleibt beim Seitwärts-Scrollen)       │ 39 Parameterspalten  → → → → → →  │
│ Probe │Auftrag│Dienstleistung│Analyse│Datum│ SiO₂ │ Al₂O₃ │ … │ K-Wert │ BET   │
├───────┼───────┼──────────────┼───────┼─────┼──────┼───────┼───┼────────┼───────┤
│P260039│FG-…14 │ RFA          │ M…01  │10.11│ 5,16 │  1,1  │   │        │       │
│P260042│FG-…14 │ BET          │ M…02  │10.11│      │       │   │        │ 12,3  │
│P260052│FG-…14 │ NOx / K-Wert │ M…03  │11.11│      │       │   │ 0,42   │       │
└───────────────────────────────────────────┴───────────────────────────────────┘
```

- **Zeilen:** Eine pro Analyse. Hat eine Analyse mehrere eigenständige Durchläufe
  (z. B. mehrere Messungen in einem Messdatenblock), gibt es **eine Zeile pro Durchlauf**.
- **Fixierte linke Spalten (520 Pixel breit):** Probe (mit Probenbezeichnung und ggf. „Ersatzprobe für …“),
  Auftrag (ggf. mit technischer Nummer), Dienstleistung, Analyse (mit Durchlaufname und kleinem
  Symbol für die Auftraggeber-Vorgaben) und Datum. Diese Zellen dürfen mehrzeilig werden,
  deshalb sind die Zeilen hoch.
- **Parameterspalten:** mindestens 120 Pixel breit, Überschrift mit Einheit („Name [Einheit]“),
  Werte rechtsbündig. Ein fehlender Wert bleibt leer, eine gemessene 0 wird als 0 gezeigt.
  Die Nachkommastellen richten sich nach den hinterlegten Anzeigeregeln.
- **Scrollen:** Die Kopfzeile bleibt oben stehen (Tabelle ist maximal 70 % der Bildschirmhöhe hoch),
  die Identifikationsspalten bleiben links stehen. Es gibt keine Sortierung, keine Gruppierung
  und keine Seitenaufteilung.
- **„Angezeigte Parameter (39/39)“:** Ein Auswahlfenster mit einer langen, einfachen Liste aller
  Spalten zum Ein-/Ausblenden. Die Auswahl gilt nur für die aktuelle Sitzung (nach dem Neuladen
  wieder alle).
- **Klick auf eine Zeile** macht nichts. Nur das kleine Symbol in der Spalte „Analyse“ öffnet die
  Auftraggeber-Vorgaben.

### 1.3 Woher die 39 Spalten kommen

Die Spalten werden **nicht** aus den gerade angezeigten Zeilen gebaut, sondern aus einer
„stabilen Ergebnisstruktur“ (`buildServiceSchemas`):

1. Für jede Messart (Dienstleistung) gibt es – falls gepflegt – eine festgelegte Liste von
   Ergebnisparametern in fester Reihenfolge.
2. Dazu kommen alle Ergebnisse, die in den Daten tatsächlich vorkommen und nicht definiert sind
   (hinten angehängt, damit nie ein Ergebnis verloren geht – z. B. beim RFA-Import).
3. Diese Listen aller Messarten werden **zu einer einzigen Spaltenliste zusammengefügt**
   (`flattenSchemas`). Gleich benannte Parameter verschiedener Messarten teilen sich dabei eine Spalte.
4. Wichtig: Die Struktur wird **bewusst aus der gesamten, ungefilterten Datenbasis** gebaut.
   Filter ändern also nie die Spalten. Das war eine absichtliche Entscheidung (stabile Struktur,
   gleich bleibender Export) – sie ist aber genau der Grund, warum bei einem Filter auf „nur BET“
   trotzdem alle 39 Spalten bleiben.

Die Daten liegen also **schon nach Messart sortiert vor** (`serviceSchemas`); die Seite fügt sie nur
für die Anzeige zu einer Liste zusammen. Das ist die gute Nachricht für die Verbesserung.

### 1.4 Warum die Tabelle so leer wirkt (Schlussfolgerung aus dem Code)

- Jede Zeile gehört genau einer Messart, hat aber 39 Spalten. Eine BET-Zeile kann nur die
  BET-Parameter füllen, alle anderen Zellen (RFA, NOx, Geometrie …) bleiben leer.
- Die Spalten stehen in der Reihenfolge der Messarten (alphabetisch), innerhalb jeder Messart
  in der definierten Reihenfolge, nicht definierte Werte zuletzt. Dass ein BET-Wert „ganz rechts“
  steht, deutet darauf hin, dass dieser Parameter für BET nicht als Definition hinterlegt ist und
  hinten angehängt wurde. Das kann ich prüfen, sobald ich echte Daten sehe.
- Die linken, fixierten Spalten belegen allein 520 Pixel, weil Probenbezeichnung,
  Ersatzprobe-Hinweis, technische Auftragsnummer und Durchlaufname in eigenen Zeilen darunter stehen.
  Auf einem kleineren Bildschirm bleibt für die Werte kaum Platz.

### 1.5 Zusammenhang mit Export und Statistik

| Bereich | Nutzt dieselbe Datenbasis? | Hängt von der Matrixansicht ab? |
|---|---|---|
| **Export** (CSV/Excel, „gefiltert“ und „alle“) | Ja: dieselben gefilterten Messungen und **dieselbe vollständige Spaltenliste** (alle 39, unabhängig von „Angezeigte Parameter“). Zusätzlich Spalten wie Messkontext, Projekt, Auftraggeber, Messdienstleister. | **Nein.** Ausgeblendete Spalten, Reiter und Anzeige haben keinen Einfluss. Die Exportstruktur ist bewusst immer gleich. |
| **Statistik & Diagramme** | Ja: dieselben gefilterten Messungen, nur offizielle Werte. Die auswählbaren Achsen kommen aus den tatsächlich vorhandenen Zahlenwerten. | **Nein.** Eigene Auswahl, nutzt die Matrix-Spalten nicht. |
| **Filter und Chips** | Wirken auf Matrix, Statistik und Export gleich. | – |

Folge für die Umsetzung: **Man kann die Matrix umbauen, ohne Export und Statistik anzufassen** –
solange man die gemeinsame Spaltenliste (`resultSchema.ts`) nicht verändert. Ein Umbau betrifft dann
nur `ResultsMatrixTable.tsx` und den Matrix-Reiter in `ResultsDatabasePage.tsx`.

### 1.6 Bezug zu dem, was schon gebaut wurde

Die **„Ergebnisübersicht“** eines Auftrags (Seitenleiste, Schritt 3) ist eigentlich schon eine kleine,
gute Matrix: je Messart eine Tabelle, Proben als Zeilen, nur Spalten mit offiziellen Werten.
Die globale Ergebnismatrix könnte dieselbe Idee **über alle Aufträge** hinweg bekommen.

---

## 2. Verbesserungsvorschläge

Legende: **Aufwand** klein = ca. ½–1 Tag · mittel = 1–3 Tage · groß = mehr als 3 Tage.
**Risiko** = Gefahr, dass etwas Bestehendes kaputtgeht oder Werte falsch/unvollständig angezeigt werden.

### M1 – Eine Matrix pro Messart (Auswahl oben)

```
 Messart:  ( BET )  ( RFA )  ( NOx / K-Wert )  ( Geometrie )  ( Alle )
 ┌────────┬────────┬────────┬───────┬───────────┬────────────┐
 │ Probe  │ Auftrag│ Analyse│ Datum │ BET [m²/g]│ Porenvol.  │
 ├────────┼────────┼────────┼───────┼───────────┼────────────┤
 │P260042 │ FG-14  │ M…02   │ 10.11 │   12,3    │   0,05     │
 │P260077 │ FG-19  │ M…09   │ 12.11 │   11,8    │   0,04     │
```

- **Was ändert sich:** Oben wählt man eine Messart (Knöpfe/Reiter). Die Tabelle zeigt nur noch
  die Spalten dieser Messart und nur deren Zeilen. Die Spalte „Dienstleistung“ entfällt, weil sie
  überall gleich wäre. „Alle“ bleibt als Ansicht erhalten (wie heute) für Sonderfälle.
- **Nutzen:** hoch. Löst „viele leere Zellen“ und „weit seitwärts scrollen“ direkt an der Wurzel.
- **Aufwand:** klein bis mittel. Die Spalten je Messart liegen im Code bereits getrennt vor.
- **Risiko:** gering. Export und Statistik bleiben unberührt. Zu beachten: Gleich benannte Parameter
  verschiedener Messarten (z. B. „Masse“) sind heute eine gemeinsame Spalte; in der Messart-Ansicht
  wird nur der Teil dieser Messart gezeigt – das ist sogar übersichtlicher.
- **Frage dazu:** Welche Messart soll beim Öffnen vorausgewählt sein? (Siehe Frage 1.)

### M2 – Nur Spalten mit Werten zeigen (Schalter „Leere Spalten ausblenden“)

- **Was ändert sich:** Spalten, in denen in den **aktuell gefilterten Zeilen** kein einziger Wert steht,
  werden ausgeblendet. Ein Schalter erlaubt, sie wieder einzublenden („Alle Spalten“).
  Die Zahl in „Angezeigte Parameter (12 von 39)“ zeigt, was gerade zu sehen ist.
- **Nutzen:** hoch – besonders zusammen mit M1 (innerhalb einer Messart sind manche Parameter
  trotzdem für die gewählten Filter leer) und bei Filtern auf einzelne Projekte/Proben.
- **Aufwand:** klein.
- **Risiko:** gering bis mittel. Das widerspricht dem heutigen Grundsatz „Spalten bleiben bei Filtern
  stabil“. Deshalb **nur in der Anzeige** der Matrix, **nie im Export**, und mit klarem Hinweis
  („3 leere Spalten ausgeblendet“). Der Erklärtext im Kopf müsste angepasst werden.

### M3 – Kompaktere Zeilen und schlankere Kennungsspalten

```
 Heute (hohe Zeilen, 520 px):          Vorschlag (einzeilig, ca. 260 px):
 Probe        Auftrag   Dienstl. …     Probe / Auftrag          Analyse   Datum
 P260039      FG-260014 RFA            P260039 · FG-260014      M…01      10.11.
 Fliese weiß  (techn. Nr. …)           (Probenname im Tooltip)
 Ersatz für …
```

- **Was ändert sich:** Probe und Auftrag in **eine** Spalte („P260039 · FG-260014“), Probenbezeichnung,
  „Ersatzprobe für …“ und technische Auftragsnummer als **Tooltip** bzw. in der Seitenleiste (M5).
  Zeilenhöhe fest einzeilig, kleinere Innenabstände. Optional ein Umschalter „Kompakt / Normal“.
  Die Spalte „Dienstleistung“ entfällt bei M1.
- **Nutzen:** hoch. Mehr Platz für Werte, mehr Zeilen auf dem Bildschirm.
- **Aufwand:** klein.
- **Risiko:** gering. Es verschwindet keine Information, sie wandert in Tooltip/Seitenleiste.
  Darauf achten, dass die fixierten Spalten weiterhin deckend bleiben (ist heute bewusst so gebaut).

### M4 – Gruppierung nach Auftrag (wie in der Probenübersicht)

```
 ▾ FG-260014   Projekt X   3 Proben
     P260039   RFA   SiO₂ 5,16   Al₂O₃ 1,1  …
     P260042   RFA   SiO₂ 6,02   Al₂O₃ 0,9  …
     P260052   RFA   SiO₂ 5,80   Al₂O₃ 1,0  …
 ▸ FG-260019   Projekt Y   2 Proben
```

- **Was ändert sich:** Die Zeilen werden unter einer aufklappbaren Auftragszeile zusammengefasst,
  die Proben eines Auftrags stehen direkt untereinander und lassen sich gut vergleichen.
  Die Auftragsspalte entfällt in den Zeilen. Optional ein Umschalter „Gruppieren nach Auftrag: an/aus“.
- **Nutzen:** mittel bis hoch. **Aber:** Die „Ergebnisübersicht“ in der Seitenleiste leistet das für
  **einen** Auftrag bereits. M4 lohnt sich nur, wenn du Aufträge **gleichzeitig** nebeneinander
  vergleichen willst (siehe Frage 3).
- **Aufwand:** mittel (Gruppenzeilen zusammen mit fixierten Spalten und Kopfzeile sauber gestalten).
- **Risiko:** mittel. Das Zusammenspiel aus „sticky“-Spalten, Gruppenzeilen und Scrollen ist
  fehleranfällig; braucht sorgfältige Prüfung am Bildschirm.

### M5 – Klick auf eine Zeile öffnet die Seitenleiste (V9)

- **Was ändert sich:** Klick auf eine Matrixzeile öffnet dieselbe Seitenleiste wie in der
  Probenübersicht (Wertetabelle, Formular, Dateien, Historie …); die gewählte Zeile ist markiert,
  Pfeiltasten wechseln die Zeile. Die Vorgaben-Schaltfläche in der Analyse-Spalte bleibt.
- **Nutzen:** hoch: Man sieht in der Matrix die Zahlen und kann bei Auffälligkeiten sofort
  nachsehen, **woher** ein Wert kommt (inkl. vorläufiger Werte, Formular, Importinfo).
- **Aufwand:** mittel. Die Seitenleiste existiert, aber ihr Layout (geteilte Ansicht, Pfeiltasten)
  hängt heute am Reiter „Probenübersicht“ und müsste für den Matrix-Reiter mitgenutzt werden.
  Die Zeile → Probe-Zuordnung ist vorhanden (Messung, Probe und Auftrag stehen in jeder Zeile).
- **Risiko:** gering. Nur zusätzliche Anzeige. Hinweis: Die Matrix zeigt nur offizielle Werte, die
  Seitenleiste auch vorläufige – das ist gewollt, sollte aber kurz erklärt werden.

### M6 – Parameter-Auswahl besser bedienbar

- **Was ändert sich:** Die lange Checkbox-Liste wird nach **Messart** (und ggf. Gruppen wie
  „Hauptoxide“) gegliedert, mit „Alle/Keine/Nur diese Messart“ und Suchfeld. Die Auswahl wird
  gemerkt (nicht nur bis zum Neuladen).
- **Nutzen:** mittel; wird mit M1/M2 deutlich weniger wichtig.
- **Aufwand:** klein. **Risiko:** gering.

### M7 – Gruppenüberschriften und Sortierung (optional)

- **Gruppenüberschriften:** Der Code kennt bereits Parametergruppen („Gruppe: Hauptoxide“ in der
  Parameterbeschreibung), zeigt sie in der Matrix aber nicht. Eine Zeile über den Spaltenköpfen
  („Hauptoxide | Spurenelemente | …“) würde RFA-artige Tabellen lesbarer machen.
- **Sortieren:** Klick auf eine Spaltenüberschrift sortiert die Zeilen (Wert, Datum, Probe).
- **Aufwand:** klein je Funktion. **Risiko:** gering.

### Übersicht

| Nr. | Vorschlag                                  | Nutzen        | Aufwand      | Risiko        |
|-----|--------------------------------------------|---------------|--------------|---------------|
| M1  | Eine Matrix pro Messart                    | hoch          | klein–mittel | gering        |
| M2  | Leere Spalten ausblenden (Schalter)        | hoch          | klein        | gering–mittel |
| M3  | Kompakte Zeilen, schlanke Kennungsspalten  | hoch          | klein        | gering        |
| M4  | Gruppierung nach Auftrag                   | mittel–hoch   | mittel       | mittel        |
| M5  | Zeilenklick öffnet Seitenleiste (V9)       | hoch          | mittel       | gering        |
| M6  | Parameter-Auswahl gegliedert und gemerkt   | mittel        | klein        | gering        |
| M7  | Gruppenüberschriften / Sortierung          | niedrig–mittel| klein        | gering        |

---

## 3. Empfohlene Reihenfolge (kleine Schritte)

Jeder Schritt ist ein eigener Arbeitszweig mit eigener Prüfung durch den Reviewer.
Export und Statistik bleiben in allen Schritten unangetastet (die Spaltenliste in `resultSchema.ts`
wird nicht verändert).

1. **M1 + M2:** Messart-Auswahl und „Leere Spalten ausblenden“. Größter Gewinn bei geringem Risiko.
   Erklärtext der Matrix anpassen.
2. **M3:** Kennungsspalten und Zeilen kompakter machen. Baut auf Schritt 1 auf (Dienstleistungsspalte
   entfällt).
3. **M5:** Zeilenklick öffnet die Seitenleiste. Danach hat die Matrix dieselbe Bedienung wie die
   Probenübersicht.
4. **M6 + M7:** Parameter-Auswahl, Gruppenüberschriften, Sortierung – nur falls nach Schritt 1–3
   noch gewünscht.
5. **M4 (Gruppierung nach Auftrag):** bewusst zuletzt und nur bei Bedarf, weil die Ergebnisübersicht
   eines Auftrags die Hauptaufgabe schon abdeckt und M4 das höchste Risiko hat.

---

## 4. Offene Fragen an dich

1. **Welche Messarten schaust du in der Matrix am häufigsten an?** Soll beim Öffnen eine
   bestimmte Messart vorausgewählt sein (z. B. die zuletzt benutzte) – oder lieber „Alle“ wie heute?
2. **Brauchst du die Ansicht „Alle Messarten in einer Tabelle“ überhaupt noch?**
   Wenn nein, kann sie entfallen (einfacher). Wenn ja: wofür (z. B. Messarten übergreifende Vergleiche)?
3. **Aufträge nebeneinander vergleichen?** Vergleichst du in der Matrix mehrere Aufträge gleichzeitig
   (dann lohnt M4), oder reicht die „Ergebnisübersicht“ pro Auftrag?
4. **Leere Spalten (M2):** Sollen sie standardmäßig ausgeblendet sein (mit Schalter zum Einblenden)
   oder standardmäßig sichtbar bleiben?
5. **Welche Kennungsspalten brauchst du wirklich sichtbar?** Mein Vorschlag: Probe · Auftrag ·
   Analyse · Datum; alles andere (Probenbezeichnung, Ersatzprobe, technische Nummer, Messart)
   als Tooltip bzw. in der Seitenleiste. Fehlt dir etwas?
6. **Export:** Er enthält heute immer alle 39 Spalten (auch leere). Soll es zusätzlich
   „Export der aktuellen Ansicht“ geben (nur gewählte Messart und sichtbare Spalten), oder soll der
   Export unverändert bleiben? (Das wäre eine Änderung am Export und ein eigener Schritt.)
7. **Parameter, die „am falschen Ort“ stehen:** Du hast erwähnt, dass BET-Werte ganz rechts stehen.
   Wenn du mir ein Beispiel (Messart + Parametername) nennst, prüfe ich, ob für BET die Ergebnisparameter
   hinterlegt sind oder die Werte nur hinten angehängt werden. Das beeinflusst die Spaltenreihenfolge
   in M1.
8. **Screenshots:** Falls du `ergebnis-matrix.png` o. Ä. in `tasks/` ablegst, gleiche ich die
   Vorschläge damit noch einmal ab.
9. **Bildschirmgröße:** Arbeiten die Nutzer überwiegend an großen Monitoren? (Wichtig für M3 und M5:
   die geteilte Ansicht mit Seitenleiste braucht Breite.)
