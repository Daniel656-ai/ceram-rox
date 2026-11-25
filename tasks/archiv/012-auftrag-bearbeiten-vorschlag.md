# 012 – Auftrag im vollständigen Formular bearbeiten (Vorschlag)

> Nur Vorschlag. Es wurde **kein Code geändert**, kein Arbeitszweig angelegt, nichts committet, keine Datenbank angefasst.
> Grundlage: `tasks/012-auftraege-aendern.txt`, der Code der Seite „Auftrag erstellen“ (`CreateOrderPage.tsx`),
> der Auftragsdetailseite (`OrderDetailPage.tsx`) und die vorhandenen Datenbank-Schutzregeln (Migrationen).
> Alles, was ich nicht im Code belegen konnte, ist als **„zu prüfen“** markiert.

---

## 0. Kurzfassung

- **Heute:** „Bearbeiten“ öffnet ein kleines Fenster (Auftragstyp, Priorität, Fälligkeit, Anmerkungen).
  Alles andere (Projekt, Proben, Dienstleistungen, Auftraggeber-Formular) ist nach dem Anlegen nicht änderbar,
  außer über Sonderwege (Auftraggeber-Vorgaben nachträglich ändern, Proben-Zuordnung, Admin-Löschen einer Dienstleistung).
- **Vorgabe von dir (Update): „Bearbeiten“ soll genauso aussehen und sich genauso bedienen wie „Auftrag erstellen“** –
  gleiche Seite, gleiche Reihenfolge, gleiche Felder, nur vorausgefüllt und mit gesperrten Teilen.
- **Lösung: dieselbe Seite im Bearbeiten-Modus** (Abschnitt 1.3). Es gibt **eine** Maske und **einen** Satz Eingabefelder;
  der Modus entscheidet nur über drei Dinge: **(1) woher die Werte kommen** (leer bzw. aus einem Entwurf – oder aus dem
  bestehenden Auftrag), **(2) was gesperrt ist** (Sperr-Angaben aus der Datenbank) und **(3) was „Speichern“ tut**
  (neu anlegen – oder Änderungen auf den bestehenden Auftrag anwenden). Dadurch kann nichts auseinanderlaufen:
  ein neues Feld in der Maske erscheint automatisch auch beim Bearbeiten.
- **Gute Voraussetzung im Code:** Die Seite kann ihre **gesamten Felder bereits aus einem gespeicherten Stand füllen**
  (Entwurfsfunktion) und es gibt schon eine geprüfte Umwandlung „bestehender Auftrag → Maskenstand“
  (`buildPayloadFromOrder`, bisher für „Als Vorlage verwenden“). Beides wird wiederverwendet statt neu geschrieben.
- **Speichern beim Bearbeiten** läuft über eine **neue atomare Datenbankfunktion** (alles oder nichts, mit Protokoll und
  Begründung) und berechnet die Änderungen als **Vergleich „Ausgangsstand ↔ aktueller Stand“** an einer einzigen Stelle.
- **In Stufen umsetzen** (Abschnitt 8), beginnend mit einer **Vorbereitung ohne sichtbare Änderung** (Seite aufräumen,
  damit der Modus sauber eingebaut werden kann), dann Bearbeiten-Modus für Kopfdaten/Proben/Auftragsformular, dann
  Dienstleistungen (zuletzt Hinzufügen/Entfernen, größtes Risiko).
- **Datenbank-Änderungen sind nötig** (neue Funktionen/Protokollierung) → als **Migration**, klar markiert für **Stefan** (Abschnitt 9).

---

## 1. Wie das Erstellen-Formular aufgebaut ist – und ob man es wiederverwenden kann

### 1.1 Aufbau der Seite „Auftrag erstellen“

```
 [Einzelauftrag | Sammel-Anlage (Batch)]        (Batch ist eine eigene Funktion, hier nicht relevant)

 ┌ Auftragsdetails ───────────────────────────────────────────────────────────┐
 │ Auftragstyp *       Kunde / Produktion / F&E (intern wird nicht angeboten)  │
 │ Verrechnet?         nur bei „Kunde“                                         │
 │ Auftragsart *       Labor  |  Pilot Plant                                   │
 │ Probe(n) *          Probenauswahl (mehrere möglich)                         │
 │ Projekt             Pflicht bei F&E, sonst optional                         │
 │ Priorität · Fälligkeitsdatum · Anmerkungen                                  │
 └─────────────────────────────────────────────────────────────────────────────┘
 ┌ Auftragsformular (je Auftragsart) ─────────────────────────────────────────┐
 │ z. B. „Pilot Plant Auftragsformular“ – im Formulardesigner konfiguriert,    │
 │ Werte landen im Auftrag (shared_form_data.template.values), inkl. Versuchs- │
 │ nummer                                                                       │
 └─────────────────────────────────────────────────────────────────────────────┘
 ┌ Ausgewählte Dienstleistungen / Messungen ──────────────────────────────────┐
 │ Auswahl einzeln oder per Servicepaket; je Dienstleistung: Auftraggeber-     │
 │ Vorgaben (Parameter) + Formularwerte; Regeln fügen manche Dienstleistungen  │
 │ automatisch hinzu bzw. gleichen die Auswahl mit dem Auftragsformular ab     │
 └─────────────────────────────────────────────────────────────────────────────┘
 ┌ Prozessvorlage (optional) ──────────────────────────────────────────────────┐
 └─────────────────────────────────────────────────────────────────────────────┘
 [Entwurf speichern]                                     [Abbrechen] [Auftrag anlegen]
```

### 1.2 Was „Auftrag anlegen“ im Hintergrund tut (vereinfacht, in dieser Reihenfolge)

1. Auftrag anlegen (**Auftragsnummer automatisch**: Kurzzeichen des Erstellers + Jahr + laufende Nummer – *unabhängig vom Auftragstyp*).
2. Bei Pilot Plant: Pilot-Plant-Bausteine anlegen.
3. Werte des Auftragsformulars im Auftrag speichern.
4. Optional: Prozessvorlage → eigener Prozessauftrag mit Workflow-Schritten.
5. Proben dem Auftrag zuordnen (mehrere möglich).
6. Je Dienstleistung: Messaufgabe anlegen, Auftraggeber-Vorgaben speichern, Formularfelder/Startwerte anlegen,
   Hochgeladenes und Vorlagen anhängen.
7. Regelabgleich (automatisch ergänzte Dienstleistungen) und Abgleich „293er“-Regel.

### 1.3 Entscheidung: dieselbe Seite im Bearbeiten-Modus (kein zweiter Code)

**Prinzip:** Es bleibt bei **einer** Seite („Auftrag erstellen“, Datei `CreateOrderPage.tsx`) mit **einem** Satz Karten und Feldern.
Dieselbe Seite wird unter einer zweiten Adresse (z. B. `/auftraege/<Nr>/bearbeiten`) im **Bearbeiten-Modus** geöffnet. Der
Modus ändert nur Titel/Knöpfe und diese drei Punkte:

| Punkt | Erstellen | Bearbeiten |
|---|---|---|
| **1. Woher kommen die Werte?** | leer, oder aus einem Entwurf (`?draft=…`) | **aus dem bestehenden Auftrag** (gleicher „Maskenstand“ wie ein Entwurf, nur mit den echten Werten) |
| **2. Was ist gesperrt?** | nichts | **Sperr-Angaben aus der Datenbank** je Feld/Karte/Dienstleistung/Probe (🔒 + Hinweis „bereits in Bearbeitung“) |
| **3. Was tut „Speichern“?** | Auftrag neu anlegen (heutiger Ablauf, **unverändert**) | **Änderungen anwenden**: Vergleich „Ausgangsstand ↔ jetzt“, dann **eine atomare Datenbankfunktion** |

**Was dafür schon da ist (wird wiederverwendet, nicht neu gebaut):**
- Die Seite füllt **alle** ihre Felder bereits aus einem gespeicherten Stand (Entwurf): Projekt, Auftragstyp, Auftragsart, Priorität,
  Fälligkeit, Anmerkungen, Dienstleistungen mit Vorgaben/Formularwerten, Proben, Auftragsformular, Prozessvorlage.
- Es gibt eine geprüfte Umwandlung **„bestehender Auftrag → Maskenstand“** (`buildPayloadFromOrder`, mit Tests; heute für
  „Als Vorlage verwenden“). Sie löst die schwierigen Teile (Vorgaben/Formularwerte den richtigen Feldern zuordnen). Für das
  Bearbeiten wird sie **erweitert** (Option „Identität behalten“: Fälligkeit, Proben, Verweise auf die vorhandenen Aufgaben
  mitnehmen) – **nicht kopiert**.

**Was neu dazukommt (klein gehalten):**
1. **Lade-Weg „Auftrag“** neben dem Lade-Weg „Entwurf“ (gleiche Zielfelder).
2. **Sperr-Angaben** (eine Datenbankabfrage: pro Aufgabe „unberührt?“ + Gründe, pro Probe „gemessen?“, Auftrag „gesperrt?“) und ein kleiner
   Baustein „gesperrtes Feld“ (ausgegraut + Hinweis), der in den **vorhandenen** Feldern eingesetzt wird. Im Erstellen-Modus gibt es keine
   Sperren – derselbe Code, alles frei.
3. **Änderungsvergleich** als **eine reine Funktion** („Ausgangsstand“ + „aktueller Stand“ → Liste der Änderungen: Kopf geändert,
   Probe +/–, Dienstleistung +/–, Vorgabe geändert), **mit Tests**. Sie ist die **einzige** Stelle, die „was hat sich geändert“ weiß.
4. **Atomare Datenbankfunktion** „Änderungen anwenden“ (alles oder nichts, prüft Sperren **serverseitig**, schreibt Protokoll + Begründung).

**Was im Bearbeiten-Modus ausgeblendet bzw. fest ist:** Sammel-Anlage (Batch), Entwurf-Speichern/Autosave (stattdessen „Änderungen
verwerfen“), Prozessvorlage (nur anzeigen), Auftragsnummer/Auftragsart/Ersteller (nur anzeigen), Produktionsfreigabe/m³-Liste (nur anzeigen).

**Der heikle Punkt (ehrlich):** Die Maske denkt in „**Dienstleistungs-Karte × alle gewählten Proben**“; gespeichert wird aber **je Probe eine eigene Aufgabe**
(Dienstleistung A × Probe 1, A × Probe 2 …). Beim Bearbeiten muss die Maske aus den vorhandenen Aufgaben wieder Karten bilden und beim Speichern
jede geänderte Karte den richtigen Aufgaben zuordnen. Das kann `buildPayloadFromOrder` teilweise schon (bündelt probenweise Aufgaben zu einer Karte),
ist aber der **Teil mit dem meisten Prüfaufwand** (Tests mit mehreren Proben/gesperrten Aufgaben nötig).

**Risiko „Seite wird angefasst“:** Die Seite hat rund 1.550 Zeilen und – soweit ich sehe – **keinen automatischen Test, der sie komplett rendert**.
Darum beginnt die Umsetzung mit einer **Vorbereitung ohne sichtbare Änderung** (Stufe 0 in Abschnitt 8): „Speichern“ und „Laden“ in
klar getrennte, getestete Funktionen auslösen, ohne dass sich für das Erstellen etwas ändert. Erst danach wird der Bearbeiten-Modus eingebaut.

**Verworfen:** eine zweite, eigene Bearbeiten-Seite mit nachgebauten Feldern – das würde schon beim nächsten neuen Feld
auseinanderlaufen (genau das soll nicht passieren).

---

## 2. Was darf wann geändert werden? (Regelvorschlag)

Die Datenbank kennt schon sehr genaue Kriterien dafür, ob eine Dienstleistung „unberührt“ ist
(`preview_delete_order_measurement` / `delete_order_measurement`, Migration `0020`). Dieselben Kriterien sollten
für **alle** Sperren gelten – eine einzige Wahrheit:

> **Unberührt** = Aufgabe noch im Zustand „offen“ **und** keine Ergebnisse, keine Rohdaten, keine Ergebnis-Korrekturen,
> keine Arbeitszeit-Buchungen, keine Dokumente, keine hochgeladenen Dateien **und** der Auftrag ist nicht abgeschlossen/gesperrt.

### 2.1 Sperrstufen

```
 Stufe A  Auftrag abgeschlossen/gesperrt          → NICHTS änderbar (gibt es schon: is_order_locked)
 Stufe B  Auftrag läuft, aber diese Dienstleistung → Dienstleistung gesperrt („bereits in Bearbeitung“)
          ist nicht mehr unberührt                   nur Sonderwege (Vorgaben nachträglich ändern, s. u.)
 Stufe C  Dienstleistung unberührt                 → frei änderbar / entfernbar
```

### 2.2 Je Feld

| Bereich | Solange nichts gemessen wurde | Sobald (irgend)etwas begonnen/gemessen wurde | Auftrag abgeschlossen |
|---|---|---|---|
| Priorität, Fälligkeit, Anmerkungen | änderbar | **änderbar** (organisatorisch, keine Messdaten) | gesperrt |
| Projekt | änderbar | **gesperrt** (hängt an Arbeitszeiten/Auswertungen) – Ausnahme siehe Frage 5 | gesperrt |
| Auftragstyp | änderbar mit Warnung (Abschnitt 3) | **gesperrt** | gesperrt |
| Verrechnet (nur Kunde) | wie bisher (nur Ersteller/Master, eigene Funktion `set_order_billed`) | wie bisher | wie bisher |
| Proben des Auftrags | Probe hinzufügen/entfernen | Probe, an der **gemessen** wurde: gesperrt; weitere Proben hinzufügen: möglich | gesperrt |
| Auftragsformular (z. B. Pilot-Plant-Formular) | änderbar | änderbar, solange nur *organisatorische* Felder betroffen sind – sonst nur mit Begründung (zu klären, Frage 6) | gesperrt |
| Auftraggeber-Vorgaben je Dienstleistung | änderbar | **nur über „Vorgabe nachträglich ändern“ mit Begründung** (gibt es schon, Funktion `amend_order_spec`; nicht bei abgeschlossener Aufgabe) | gesperrt |
| Dienstleistung **hinzufügen** | möglich | möglich (neue Aufgabe, Workflow wird erweitert) | gesperrt |
| Dienstleistung **entfernen** | möglich | **nur unberührte**; begonnene gesperrt | gesperrt |
| Auftragsart (Labor/Pilot Plant), Auftragsnummer, Ersteller | **nie änderbar** (nur anzeigen) | – | – |
| Prozessvorlage / Prozessauftrag | **nie änderbar** (nur anzeigen) | – | – |
| **Produktionsfreigabe / m³-Liste** | **nie frei änderbar** – nur über die m³-Liste (nur anzeigen, mit Hinweis) | – | – |

### 2.3 Was passiert beim Entfernen/Hinzufügen?

- **Dienstleistung entfernen (nur unberührt):** Löschen über die vorhandene, geprüfte Funktion (`delete_order_measurement`):
  Begründung Pflicht (mind. 5 Zeichen), mitgelöschte Auftraggeber-Vorgaben werden im Protokoll gesichert, Proben und
  Folgeaufgaben bleiben erhalten (die Funktion zeigt die Folgen vorab: „Vorschau“). **Heute darf das nur ein Master** (Admin-Karte).
  Frage 4: Soll der Ersteller das für **seine unberührten** Dienstleistungen ebenfalls dürfen?
- **Dienstleistung hinzufügen:** wie beim Anlegen (Aufgabe + Vorgaben + Formularfelder); die Datenbank erweitert den
  Workflow automatisch (`order_measurements_expand_workflow`). Danach Regelabgleich wie beim Anlegen.
  *Heute gibt es in der Oberfläche keinen Weg, nach dem Anlegen eine Dienstleistung hinzuzufügen* (nur beim Anlegen/Import).
  Ob die Datenbank-Berechtigungen das für den Ersteller auf einem bestehenden Auftrag zulassen, ist **zu prüfen** (Einfügen ist für Ersteller/Master vorgesehen).
- **Probe hinzufügen/entfernen:** Die Proben-Karte erlaubt das heute schon (Master oder Ersteller solange der Auftrag „offen“ ist).
  Neu wäre nur: Sperre pro Probe, sobald daran gemessen wurde, und Protokollierung.
- **Regelabgleich:** Beim Hinzufügen/Entfernen/Ändern laufen die vorhandenen Regeln (automatisch ergänzte Dienstleistungen) mit;
  dabei werden **nur unberührte** Dienstleistungen angepasst, nie begonnene.

---

## 3. Auftragstyp ändern – Folgen

Gute Nachricht zuerst: **Die Auftragsnummer hängt nicht vom Typ ab** (Kurzzeichen des Erstellers + Jahr + Zähler). Ein Typwechsel ändert die Nummer nicht.

Folgen eines Typwechsels (laut Code):

| Wechsel | Folge |
|---|---|
| → **F&E** | **Projekt wird Pflicht**; beim Abschließen von Aufgaben erscheint die **Stundenerfassung** (Arbeitszeit); Fertigungsunterlagen werden anders einsortiert |
| **Kunde** → anderer Typ | **Verrechnet-Kennzeichen** gilt nur für Kunden: es müsste zurückgesetzt/ausgeblendet werden (Hinweis „Verrechnungsstatus wird entfernt“) |
| → **Kunde** | Verrechnungsstatus wird möglich (Standard „nein“) |
| **Produktion** (mit Freigabe/m³-Liste) | Zuordnung zur Freigabe bleibt **unverändert** (nicht über diese Seite änderbar) |
| **Intern** (Prüfmittel) | **nie** über diese Seite (eigene Prüfmittelüberwachung; Interne tauchen auch nicht in der Ergebnisdatenbank auf) |
| Auftragsart **Labor ↔ Pilot Plant** | **sehr weitreichend** (Pilot-Plant-Bausteine, Auftragsformular, Versuchsnummer) → **immer gesperrt** |

**Empfehlung:** Typ nur ändern, **solange nichts begonnen wurde**; mit **klarer Warnung** im Dialog (Liste der Folgen).
Danach **gesperrt**. Auftragsart und „Intern“ sind **nie** änderbar. (Heute darf der Ersteller/Master den Typ im kleinen Fenster
ohne diese Prüfungen ändern – der Vorschlag wäre also eine **Verschärfung**.)

---

## 4. Wer darf bearbeiten?

- **Vorschlag: Ersteller und Master** – wie beim Löschen eines Auftrags und bei „Vorgabe nachträglich ändern“.
- Die Datenbank erlaubt Änderungen am Auftrag ohnehin nur Ersteller und Master (Richtlinie „Users update relevant orders“).
- Heute: Typ/Priorität/Fälligkeit nur für Master oder Auftraggeber-Ersteller solange „offen“; Anmerkungen auch später für den Ersteller.
- **Externe Kunden** dürfen nie „Intern“ erzeugen/bearbeiten (bestehende Regel bleibt).
- Frage 5 (Projektleiter?): Sollen Projektleiter eines Projekts Aufträge ihres Projekts bearbeiten dürfen? (Heute nicht.)

---

## 5. Änderungshistorie – gibt es schon etwas?

**Vorhanden:**
- **`order_audit_log`** (wer, wann, Feld, alt, neu): wird heute **automatisch nur für Priorität und Status** geschrieben (Datenbank-Trigger).
- **`activity_log`** (Aktivitätsprotokoll): z. B. „Auftraggeber-Vorgabe nachträglich geändert“ (inkl. Begründung), „Auftrag gelöscht“.
- Auf dem Auftrag gibt es den **Verlauf** (Reiter „Workflow“), der Audit-Log und Aktivitäten zusammen anzeigt.
- Ergebnis-Korrekturen haben eine eigene, lückenlose Korrekturhistorie.

**Fehlt:** Änderungen an **Typ, Projekt, Fälligkeit, Anmerkungen, Proben, Dienstleistungen, Auftragsformular** werden heute **nicht protokolliert**.

**Vorschlag:**
- Audit-Log auf weitere Felder erweitern (Typ, Projekt, Fälligkeit, Anmerkungen, Verrechnung).
- Proben- und Dienstleistungsänderungen als Ereignisse im Aktivitätsprotokoll (mit **Begründung bei sensiblen Änderungen**, z. B. Typ, Projekt, Entfernen).
- Alles erscheint im vorhandenen **Verlauf** des Auftrags.
- Beim Bearbeiten ein Feld **„Grund der Änderung“** (Pflicht bei Typ/Projekt/Entfernen, sonst optional).

---

## 6. Sollen Messdienstleister informiert werden?

**Vorhanden:** Änderungen an Auftraggeber-Vorgaben erscheinen im Auftrag und in der Messaufgabe des Messdienstleisters
(Änderungsverlauf). Eine **Benachrichtigung** („Glocke“) gibt es als Einrichtung (Tabelle `notifications`, verknüpft mit dem Aktivitätsprotokoll);
ob für „Vorgabe geändert“ automatisch Einträge entstehen, konnte ich im Code **nicht** erkennen (**zu prüfen**).

**Vorschlag (zwei Ebenen):**
1. **Immer:** Gut sichtbarer **Hinweis in der Messaufgabe/im Auftrag** („Auftrag wurde am … von … geändert: …“) – aus dem Änderungsprotokoll.
2. **Zusätzlich Benachrichtigung** an die zugewiesenen Messdienstleister, aber **nur bei relevanten Änderungen**:
   Dienstleistung hinzugefügt/entfernt, Probe geändert, Vorgabe/Auftragsformular geändert, Fälligkeit/Priorität geändert.
   Nicht bei reinen Anmerkungen. (Frage 7.)

---

## 7. Produktionsfreigabe (Rahmen)

- Die Zuordnung des Auftrags zur **Produktionsfreigabe / m³-Liste** bleibt **nicht frei änderbar** – nur über die m³-Liste.
- Auf der Bearbeiten-Seite wird sie **nur angezeigt** (gesperrt, Hinweis „über m³-Liste verwaltet“).
- Aufträge, die an einer Freigabe/Fertigungsunterlage hängen, behalten ihren Typ (Produktion) und ihre Proben, die zur Freigabe gehören, sind gesperrt (zu prüfen: genaue Verknüpfung Probe ↔ Freigabe).

---

## 8. Seitenaufbau (Skizze) und Stufenplan

### 8.1 So sieht „Bearbeiten“ aus (dieselbe Maske wie „Auftrag erstellen“, gleiche Reihenfolge)

Oben ändern sich nur Titel und Knöpfe; darunter stehen **dieselben Karten in derselben Reihenfolge** – vorausgefüllt, mit 🔒 dort, wo schon gearbeitet wurde:

```
 Auftrag MWI260003 bearbeiten                        [Änderungen verwerfen] [Änderungen speichern]
 ┌ Hinweis ───────────────────────────────────────────────────────────────────┐
 │ 🔒 = gesperrt, weil bereits in Bearbeitung. Änderungen werden protokolliert.  │
 └────────────────────────────────────────────────────────────────────────────┘
 ┌ Auftragsdetails ─────────────────────────────────────────────  (wie beim Erstellen)
 │ Auftragstyp *     [Kunde ▾]      ⚠ Folgen …                    🔒 sobald begonnen
 │ Verrechnet?       [nein ▾]                                       (wie beim Erstellen)
 │ Auftragsart *     Labor                                         🔒 nie änderbar
 │ Probe(n) *        [P260039 🔒 gemessen] [P260042 ✕] [+ Probe]
 │ Projekt           [Projekt X ▾]                                  🔒 sobald begonnen
 │ Priorität · Fälligkeitsdatum · Anmerkungen                       ✔ (solange nicht abgeschlossen)
 └──────────────────────────────────────────────────────────────
 ┌ Auftragsformular (je Auftragsart) ───────────────────────────  vorausgefüllt
 ┌ Ausgewählte Dienstleistungen / Messungen ────────────────────
 │ RFA   🔒 bereits in Bearbeitung (3 Ergebnisse)   Vorgaben: [nachträglich ändern…]
 │ BET   ✔ unberührt   Vorgaben/Formular vorausgefüllt           [Entfernen…]
 │ [+ Dienstleistung hinzufügen]  (Servicepaket / Einzelauswahl wie beim Erstellen)
 └──────────────────────────────────────────────────────────────
 ┌ Prozessvorlage ──────────────────────────────────────────────  🔒 nur anzeigen
 ┌ Produktionsfreigabe / m³-Liste ──────────────────────────────  🔒 nur über die m³-Liste
 Grund der Änderung  [____________________]          (Pflicht bei Typ / Projekt / Entfernen)
 Folgen vor dem Speichern: „1 Dienstleistung wird entfernt, 2 Vorgaben werden mitgelöscht (im Protokoll gesichert)“
```

Zusätzlich im Bearbeiten-Modus: Vor dem Speichern eine **Zusammenfassung der Änderungen** („Was wird geändert?“), damit niemand versehentlich etwas überschreibt.

### 8.2 Umsetzung in Stufen (jede Stufe eigener Arbeitszweig, Tests, Reviewer, lokale Vorschau)

| Stufe | Inhalt | Datenbank | Aufwand | Risiko |
|---|---|---|---|---|
| **0** | **Vorbereitung ohne sichtbare Änderung:** Seite aufräumen – „Anlegen“ und „Laden“ in getrennte, getestete Funktionen auslösen; Tests für die bisherige Anlege-Logik ergänzen. Das Erstellen verhält sich danach **identisch**. | nein | mittel | gering–mittel (Seite wird angefasst, aber ohne Funktionsänderung) |
| **1** | **Bearbeiten-Modus** derselben Seite: Laden aus dem Auftrag, Sperr-Anzeige, **Kopfdaten** (Typ mit Warnung, Projekt, Priorität, Fälligkeit, Anmerkungen) + **Proben** + **Auftragsformular** änderbar; Dienstleistungs-Karten sind **vorübergehend nur lesbar** (🔒 „noch nicht im Bearbeiten-Modus änderbar“); Grund, Zusammenfassung, Verlauf; Knopf „Bearbeiten“ öffnet die neue Maske | **Ja** (neue atomare Funktion „Kopfdaten/Proben ändern“, erweitertes Protokoll) | groß | mittel |
| **2** | **Dienstleistungs-Karten bearbeitbar:** Vorgaben und Formularwerte unberührter Dienstleistungen direkt; begonnene über „nachträglich ändern“ (vorhandene Funktion, mit Begründung) | gering (vorhandene Funktion nutzen, Erweiterung der atomaren Funktion) | mittel–groß | mittel |
| **3** | Dienstleistung **hinzufügen / entfernen** inkl. Regelabgleich und Folgenvorschau | ggf. Berechtigungen prüfen | groß | **hoch** |
| **4** | **Benachrichtigung** der Messdienstleister + Hinweisleiste in der Messaufgabe | evtl. Funktion für Benachrichtigung | klein–mittel | gering |

**Empfehlung:** Mit **Stufe 0** beginnen (unsichtbar, macht alles Weitere sicher), dann **Stufe 1**. Bis Stufe 2 fertig ist, sind die
Dienstleistungs-Karten im Bearbeiten-Modus lesbar, aber (mit klarem Hinweis) noch nicht änderbar – das ist eine **bewusste Zwischenlösung**,
damit die erste Auslieferung nicht zu groß wird. Wenn du die Karten von Anfang an bearbeitbar willst, verschmelzen Stufe 1 und 2 zu einem größeren Schritt.

---

## 9. Datenbank-Änderungen (für Stefan – nur als Migration, nichts davon ohne Freigabe)

Alles unten wäre **neu** (Migration, klar markiert). Bestehende Migrationen werden **nicht** geändert.
Stufe 0 braucht **keine** Datenbank-Änderung; ab Stufe 1:

1. **Sperr-Abfrage** `order_edit_locks(order_id)` (nur lesen): liefert für die Bearbeiten-Maske, was gesperrt ist – Auftrag gesperrt?, je Aufgabe
   „unberührt?“ + Gründe, je Probe „gemessen?“. **Baut auf den vorhandenen Prüfungen auf** (`is_order_locked`, `order_has_results`,
   `preview_delete_order_measurement`), statt eigene zu erfinden – eine einzige Wahrheit für Anzeige **und** Speichern.
2. **Neue Funktion** `apply_order_changes(order_id, änderungen, begründung)` (atomar, nur Ersteller/Master): wendet die vom Änderungsvergleich
   gelieferten Änderungen an, **prüft alle Sperren erneut serverseitig**, schreibt Änderungen **und** Protokolleinträge in einem Schritt;
   verlangt Begründung bei sensiblen Feldern (Typ, Projekt, Entfernen). Bei einem Fehler wird **nichts** übernommen.
3. **Audit-Trigger erweitern** (`order_audit_log`) auf Typ, Projekt, Fälligkeit, Anmerkungen (Verrechnung bleibt bei `set_order_billed`).
4. **Ereignisse** im `activity_log` für Proben-/Dienstleistungsänderungen (neue Ereignisarten).
5. Optional (Stufe 4): Funktion zum Erzeugen von **Benachrichtigungen** für zugewiesene Messdienstleister.
6. **Nicht angefasst werden:** `guard_order_delete_dependents`, `cancel_or_delete_order`, `delete_order_measurement`, `is_order_locked`/Sperr-Trigger –
   **keine Schutzregel wird geschwächt**.

**Zusage zu „keine Daten verändern/verlieren“:** Gemessene/begonnene Analysen bleiben **vollständig unangetastet**; Bearbeiten
kann sie weder löschen noch umhängen (gesperrt, serverseitig geprüft – nicht nur in der Oberfläche).

---

## 10. Prüfung vorab (SELECTs fürs Dev-Studio, nur lesen)

Falls du dir ein Bild von den echten Daten machen willst (z. B. wie viele Aufträge heute „unberührt“ wären):

```sql
-- Wie viele Aufträge/Dienstleistungen sind „unberührt“ (Status offen, keine Ergebnisse)?
select o.status, count(distinct o.id) as auftraege, count(m.id) as dienstleistungen,
       count(m.id) filter (where m.status::text = 'open'
         and not exists (select 1 from public.measurement_results r where r.order_measurement_id = m.id)
         and not exists (select 1 from public.work_logs w where w.order_measurement_id = m.id)) as unberuehrt
from public.measurement_orders o
left join public.order_measurements m on m.order_id = o.id
group by o.status order by o.status;

-- Welche Auftragstypen/-arten gibt es?
select order_type, order_kind, count(*) from public.measurement_orders group by 1, 2 order by 3 desc;
```

(Tabellen-/Spaltennamen aus dem Code abgeleitet, nicht gegen die Datenbank geprüft.)

---

## 11. Offene Fragen an dich

1. **Dieselbe Seite (neu):** Passt das Vorgehen „dieselbe Maske im Bearbeiten-Modus“ (Abschnitt 1.3) so, inklusive **Stufe 0** (Vorbereitung ohne sichtbare Änderung) als erstem Schritt?
2. **Dienstleistungs-Karten in der ersten Auslieferung:** Dürfen sie in Stufe 1 **vorübergehend nur lesbar** sein (Stufe 2 macht sie bearbeitbar), oder sollen Stufe 1 und 2 zusammen ausgeliefert werden (größerer Schritt)?
3. **Auftragstyp:** Soll er nach Beginn der Arbeit **gesperrt** sein (Empfehlung) – oder ausnahmsweise für Master änderbar (mit Begründung)?
4. **Dienstleistung entfernen:** Heute nur Master. Darf künftig auch der **Ersteller** **seine unberührten** Dienstleistungen entfernen (gleiche Prüfungen, mit Begründung)?
5. **Projekt ändern:** Erlaubt, solange nichts gebucht/gemessen ist (Empfehlung)? Darf ein **Projektleiter** Aufträge seines Projekts bearbeiten?
6. **Auftragsformular/Vorgaben nach Beginn:** Reicht „nachträglich ändern mit Begründung“ (Empfehlung), oder soll das Formular dann ganz gesperrt sein?
7. **Benachrichtigung:** Nur Hinweis im Auftrag, oder zusätzlich Benachrichtigung (Glocke) an die Messdienstleister – bei welchen Änderungen?
8. **Grund der Änderung:** Pflicht nur bei Typ/Projekt/Entfernen (Empfehlung) – oder immer?
9. **Verrechnet (Kunde):** In der Maske sichtbar wie beim Erstellen (Speichern läuft weiter über die bestehende, eigene Funktion) – einverstanden?
10. **Altes kleines Fenster:** Mit der neuen Maske **ersetzen** (Knopf „Bearbeiten“ öffnet die Maske) – oder als „Schnellbearbeitung“ (nur Priorität/Fälligkeit/Anmerkungen) **zusätzlich** behalten?
11. **Entwürfe beim Bearbeiten:** Beim Erstellen gibt es Autosave/Entwürfe. Beim Bearbeiten stattdessen nur „Änderungen speichern / verwerfen“ (Empfehlung, damit kein halber Zwischenstand den echten Auftrag überlagert) – einverstanden?
12. **Aufträge mit Prozessvorlage/Prozessauftrag oder Pilot Plant:** In Stufe 1 auf „Kopfdaten/Proben/Auftragsformular ändern“ beschränkt (Empfehlung)?
13. **Migration:** Einverstanden, dass die Datenbank-Änderungen (Abschnitt 9) als eigene Migration vorbereitet und **erst nach Freigabe durch Stefan** eingespielt werden – und die Maske bis dahin im Bearbeiten-Modus nicht ausgeliefert wird?
