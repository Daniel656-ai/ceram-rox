# 007 – Ergebnisdatenbank übersichtlicher machen (Analyse & Vorschläge)

> Reine Analyse. Es wurde **kein Code geändert**, kein Arbeitszweig angelegt, nichts committet.
>
> Hinweis: Die Screenshots `tasks/ergebnis-liste.png` und `tasks/ergebnis-detail.png` lagen beim Erstellen
> nicht im Ordner `tasks/`. Die Analyse stützt sich deshalb auf den Programmcode und deine Beschreibung.

---

## 1. Wie die Ergebnisdatenbank heute aufgebaut ist

Die Seite (Menü „Ergebnisdatenbank“, Adresse `/ergebnisse`) besteht von oben nach unten aus:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Ergebnisdatenbank                         [CSV] [Excel] [Alle Ergebn.]│
│ 123 von 456 Messungen mit offiziellem Ergebnis                       │
│ (3 Zeilen Erklärtext)                                                │
├──────────────────────────────────────────────────────────────────────┤
│ FILTER                                                [Zurücksetzen] │
│ [Volltextsuche ] [Messart ▼] [Projekt ▼] [Auftraggeber ▼]            │
│ [Messdienstl. ▼] [Proben-ID] [Ergebnismerkmal ▼] [Wert ▼]            │
│ [Datum von   ] [Datum bis ]                                          │
├──────────────────────────────────────────────────────────────────────┤
│ [ Probenübersicht ] [ Ergebnismatrix ] [ Statistik & Diagramme ]     │
│                                                                      │
│   … Inhalt des gewählten Reiters …                                   │
└──────────────────────────────────────────────────────────────────────┘
```

**Kopfbereich:** Titel, Anzahl, Erklärtext, drei Export-Knöpfe.

**Filter:** Bis zu 10 Eingabefelder in einem festen Kasten (3 Zeilen hoch), immer sichtbar.
Die Filter wirken auf alle drei Reiter gleichzeitig.

**Reiter 1 – Probenübersicht** (in drei „Ebenen“ gedacht):
- *Ebene 1 – Liste:* eine Zeile pro Probe (Probe, Bezeichnung, Projekt, Auftrag, Anzahl Analysen,
  Anzahl offizieller/vorläufiger Werte, letzte Aktivität).
- *Ebene 2 – Probendetail:* Ein Klick auf eine Zeile **ersetzt die Liste** durch die Detailansicht
  der Probe. Dort gibt es oben „Zurück zur Probenübersicht“ und dann **pro Analyse eine große Karte** mit:
  1. dem **Ergebnisformular** (das Formular, das der Messdienstleister ausgefüllt hat – schreibgeschützt,
     mit *allen* Feldern, auch den leeren), inkl. hochgeladener Dateien, und darunter
  2. der **Tabelle „Alle Messwerte dieser Analyse“** – dieselben Werte noch einmal als Liste
     (Parameter, Wert, Einheit, Status offiziell/vorläufig, Datum, Stift zum Korrigieren).
  3. Knöpfe „Auftraggeber-Vorgaben“, „Änderungshistorie“, „Details“.
- *Ebene 3 – Details:* Der Knopf „Details“ öffnet bereits heute eine **Seitenleiste von rechts**
  mit den Unterreitern Messwerte, Rohdaten & Kurven, Dateien, Änderungshistorie, Ergebnisbericht.

**Reiter 2 – Ergebnismatrix:** Große Tabelle, eine Zeile pro Analyse, eine Spalte pro Ergebnisparameter.
Die ersten Spalten (Probe, Auftrag …) bleiben beim Seitwärts-Scrollen stehen. Über „Angezeigte Parameter“
lassen sich Spalten aus-/einblenden. Zeigt nur **offizielle** Werte.

**Reiter 3 – Statistik & Diagramme:** Ein großer Einstellungskasten (Diagrammtyp, Achsen, Gruppierung,
Skalierung, Darstellung, Grenzwertlinien, gespeicherte Analysen), darunter das Diagramm, Kennzahlen
(Mittelwert, Median …) und eine automatische Auswertung in Textform. Nur **offizielle** Werte.

**Warum die Detailansicht so lang ist:** Das Ergebnisformular ist bewusst „das Original-Formular“, damit man
die Werte im fachlichen Zusammenhang sieht. Die Tabelle darunter ist eine Sicherheitsleine: Sie zeigt
*jeden* gespeicherten Wert genau einmal – auch bei alten Messungen, für die es gar kein Formular gibt,
und sie markiert, welcher Wert offiziell ist. Beides zusammen führt zu der doppelten Darstellung.

Wichtig für die Umsetzung: Das Ergebnisformular wird **auch an anderen Stellen** benutzt
(Auftragsdetail und Abschluss-Reiter im Auftrag). Änderungen daran wirken also nicht nur in der
Ergebnisdatenbank, wenn man sie nicht gezielt nur dort einschaltet.

---

## 2. Verbesserungsvorschläge

Legende: **Aufwand** klein = ca. ½–1 Tag · mittel = 1–3 Tage · groß = mehr als 3 Tage.
**Risiko** = Gefahr, dass etwas Bestehendes kaputtgeht oder Werte falsch/unvollständig angezeigt werden.

### V1 – Probendetail als Seitenleiste statt neuer Ansicht

```
┌───────────────────────────────┬──────────────────────────────────────┐
│ Probenübersicht               │ Probe P-2026-0042 · Fliese weiß   [X]│
│ ▸ P-2026-0041  Fliese grau    │ Projekt X · Auftrag A-123            │
│ ▶ P-2026-0042  Fliese weiß  ◀ │ ──────────────────────────────────── │
│ ▸ P-2026-0043  Glasur A       │ ▸ Biegefestigkeit  (5 offiz.)        │
│ ▸ P-2026-0044  Glasur B       │ ▾ Wasseraufnahme   (2 offiz.)        │
│ …                             │     Wasseraufnahme   0,42 %  ●offiz. │
│                               │     Masse trocken   12,3 g  vorl.    │
└───────────────────────────────┴──────────────────────────────────────┘
```

- **Was ändert sich:** Die Liste bleibt links stehen, die gewählte Probe erscheint rechts.
  Mit Pfeiltasten/Klick springt man direkt zur nächsten Probe – kein „Zurück“-Knopf mehr nötig.
  Die gewählte Zeile ist farbig markiert.
- **Aufwand:** mittel. Ein Seitenleisten-Baustein existiert bereits (wird für „Details“ genutzt).
- **Risiko:** gering. Es ändert sich nur die Anordnung, nicht die Daten.
- Variante: Seitenleiste **überlagert** die Liste (wie heute „Details“) statt sie zu teilen –
  einfacher, aber die Liste ist dann teilweise verdeckt.

### V2 – Aufklappbare Zeile in der Liste (Alternative zu V1)

```
│ ▸ P-2026-0041  Fliese grau    Projekt X   3 Analysen   12 offiz.      │
│ ▾ P-2026-0042  Fliese weiß    Projekt X   2 Analysen    7 offiz.      │
│     Biegefestigkeit   σ = 42,1 MPa ●   E-Modul 61 GPa ●   [Details]   │
│     Wasseraufnahme    0,42 % ●                            [Details]   │
│ ▸ P-2026-0043  Glasur A       …                                       │
```

- **Was ändert sich:** Klick klappt die Probe direkt in der Liste auf und zeigt eine **kurze
  Zusammenfassung** der wichtigsten (offiziellen) Werte. Für alles Weitere gibt es „Details“ (Seitenleiste).
- **Aufwand:** mittel.
- **Risiko:** gering. Nachteil: Bei vielen Analysen pro Probe wird die Liste lang und unruhig.
- **Meine Einschätzung:** V1 passt besser zu „ich will den Überblick behalten und viel Inhalt sehen“;
  V2 besser zu „ich will nur kurz reinschauen“. Man sollte **eines von beiden** wählen.

### V3 – Doppelte Darstellung beseitigen: „Werte“ als Standard, Formular auf Wunsch

```
 Wasseraufnahme  [M-0815]  abgeschlossen  2 offiz.
 [ Werte ]  [ Formular ]  [ Kurven ]  [ Dateien ]  [ Historie ]
 ─────────────────────────────────────────────
 Wasseraufnahme   0,42 %   ● offiziell
 Masse trocken   12,3  g     vorläufig
```

- **Was ändert sich:** Pro Analyse sieht man zuerst nur die **kompakte Wertetabelle** (die ist
  vollständig und zeigt offiziell/vorläufig). Das Original-Formular ist ein eigener Reiter
  „Formular“ und wird nur auf Klick gezeigt. Die Detailansicht wird dadurch deutlich kürzer.
- **Aufwand:** klein bis mittel.
- **Risiko:** gering. Es gehen keine Informationen verloren, das Formular ist nur einen Klick entfernt.
- Achtung: Manche Werte versteht man nur im Formular-Zusammenhang (z. B. Tabellen mit mehreren
  Durchläufen). Siehe offene Frage 2.

### V4 – Leere Felder im Ergebnisformular ausblenden

- **Was ändert sich:** Im schreibgeschützten Formular werden Felder ohne Wert (und ganze Abschnitte,
  die komplett leer sind) weggelassen – optional mit Schalter „Leere Felder anzeigen“.
- **Aufwand:** mittel. Das Formular wird von einer gemeinsamen „Formular-Maschine“ gezeichnet, die auch
  beim Erfassen benutzt wird; die Ausblendung muss sauber nur für die Leseansicht gelten.
- **Risiko:** mittel. Gefahr, dass versehentlich auch im Erfassungsformular oder im Auftragsdetail Felder
  verschwinden, oder dass berechnete Felder/Überschriften falsch als „leer“ erkannt werden.
  Braucht gute Tests. Wenn V3 umgesetzt wird, ist V4 weniger dringend.

### V5 – Detailkarten kompakter

- **Was ändert sich:** Kopf jeder Analyse in eine Zeile, Knöpfe „Auftraggeber-Vorgaben / Historie /
  Details“ als kleine Symbole bzw. in einem „⋯“-Menü, Analysen **eingeklappt** starten (nur Kopf + Anzahl
  Werte), Erklärtexte kürzer bzw. als ⓘ-Symbol mit Tooltip.
- **Aufwand:** klein.
- **Risiko:** gering.

### V6 – Einklappbare Filter / Filterleiste

```
 [🔍 Volltextsuche …………]  [Messart ▼]  [Projekt ▼]  [⚙ Weitere Filter (2)]  [✕]
 Aktiv:  (Auftraggeber: Müller ✕)  (Datum: 01.10.–31.10. ✕)
```

- **Was ändert sich:** Statt 3 Zeilen Filterkasten nur **eine Zeile** mit den wichtigsten Filtern
  (Suche, Messart, Projekt). Der Rest steckt hinter „Weitere Filter“ (klappt auf oder öffnet ein
  kleines Fenster). Gesetzte Filter erscheinen als **Chips**, die man einzeln mit ✕ entfernt.
  Die Zahl in Klammern zeigt, wie viele versteckte Filter aktiv sind.
- **Aufwand:** klein bis mittel.
- **Risiko:** gering. Gefahr nur, dass man aktive versteckte Filter übersieht – die Chips lösen das.
- Zusatz (klein): Der 3-zeilige Erklärtext oben wird zu einem ⓘ-Symbol; die Export-Knöpfe in ein
  Menü „Export ▼“.

### V7 – Klare Filter auch merken (optional)

- **Was ändert sich:** Filter, gewählter Reiter und gewählte Probe bleiben erhalten, wenn man die Seite
  verlässt und zurückkommt (z. B. über die Adresszeile, dann kann man auch einen Link auf eine
  gefilterte Ansicht weitergeben).
- **Aufwand:** mittel. **Risiko:** gering.

### V8 – Statistik-Einstellungen aufräumen (optional)

- **Was ändert sich:** Im Reiter „Statistik & Diagramme“ nur Diagrammtyp, X, Y, Gruppierung sichtbar;
  Skalierung, Darstellung, Grenzwerte und gespeicherte Analysen als einklappbare Bereiche oder als
  Seitenleiste neben dem Diagramm. Das Diagramm rückt nach oben.
- **Aufwand:** mittel. **Risiko:** gering (keine Rechenänderung, nur Anordnung).

### V9 – Ergebnismatrix: Klick auf Zeile öffnet dieselbe Seitenleiste (optional)

- **Was ändert sich:** Wer in der Matrix eine Zeile anklickt, bekommt dieselbe Detail-Seitenleiste wie
  in der Probenübersicht – einheitliche Bedienung überall.
- **Aufwand:** klein (wenn V1 fertig ist). **Risiko:** gering.

### Übersicht

| Nr. | Vorschlag                               | Nutzen  | Aufwand        | Risiko  |
|-----|-----------------------------------------|---------|----------------|---------|
| V1  | Probendetail als Seitenleiste           | hoch    | mittel         | gering  |
| V2  | Aufklappbare Zeile (Alternative zu V1)  | mittel  | mittel         | gering  |
| V3  | Werte zuerst, Formular als Reiter       | hoch    | klein–mittel   | gering  |
| V4  | Leere Formularfelder ausblenden         | mittel  | mittel         | mittel  |
| V5  | Detailkarten kompakter / eingeklappt    | mittel  | klein          | gering  |
| V6  | Filterleiste, einklappbar, mit Chips    | hoch    | klein–mittel   | gering  |
| V7  | Filter/Auswahl merken                   | niedrig | mittel         | gering  |
| V8  | Statistik-Einstellungen einklappbar     | mittel  | mittel         | gering  |
| V9  | Matrix-Zeile öffnet Seitenleiste        | niedrig | klein          | gering  |

---

## 3. Empfohlene Reihenfolge

Jeder Schritt ist ein eigener Arbeitszweig mit eigener Prüfung durch den Reviewer – so bleibt jede
Änderung klein und einzeln überprüfbar.

1. **V6 Filterleiste** – schneller, sichtbarer Gewinn, kaum Risiko, betrifft die ganze Seite.
   (Dabei gleich Erklärtext → ⓘ und Export-Menü.)
2. **V3 + V5 Detail entschlacken** – Werte zuerst, Formular als Reiter, Karten kompakter.
   Löst das Problem „lang und doppelt“ ohne das gemeinsame Formular anzufassen.
3. **V1 Seitenleiste** – löst das Problem „ich verliere die Liste“. Baut auf Schritt 2 auf, weil
   die kompaktere Detailansicht gut in eine Seitenleiste passt.
4. **V4 leere Felder ausblenden** – nur noch nötig, wenn das Formular nach Schritt 2 weiterhin oft
   angeschaut wird. Wegen des mittleren Risikos bewusst später.
5. Optional danach: **V9**, **V8**, **V7**.

---

## 4. Offene Fragen an dich

1. **Seitenleiste oder aufklappbare Zeile?** Soll die Probe rechts neben der Liste erscheinen (V1)
   oder direkt in der Liste aufklappen (V2)? Meine Empfehlung: Seitenleiste (V1).
2. **Wie wichtig ist das Original-Formular?** Reicht es, wenn man zuerst die kompakte Wertetabelle sieht
   und das Formular per Klick öffnet (V3)? Oder brauchen bestimmte Messarten das Formular als Hauptansicht?
   Wenn ja: welche?
3. **Vorläufige Werte:** Sollen in der Probendetailansicht standardmäßig nur **offizielle** Werte zu sehen
   sein (vorläufige per Schalter einblendbar), oder sollen beide immer sichtbar bleiben?
4. **Welche Filter brauchst du am häufigsten?** Diese kommen in die immer sichtbare Zeile, der Rest
   hinter „Weitere Filter“. Mein Vorschlag: Suche, Messart, Projekt.
5. **Leere Felder (V4):** Sollen sie ganz verschwinden oder nur auf Wunsch per Schalter „Leere Felder
   anzeigen“ wieder einblendbar sein? Und gilt das nur in der Ergebnisdatenbank oder auch im Auftragsdetail?
6. **Screenshots:** Die Bilder `ergebnis-liste.png` / `ergebnis-detail.png` waren nicht im Ordner
   `tasks/`. Wenn du sie ablegst, kann ich die Vorschläge damit noch einmal abgleichen.
7. **Bildschirmgröße:** Arbeiten die Nutzer überwiegend an großen Monitoren? (Eine geteilte Ansicht
   Liste + Seitenleiste braucht etwas Breite; auf kleinen Laptops würde die Seitenleiste die Liste überlagern.)
