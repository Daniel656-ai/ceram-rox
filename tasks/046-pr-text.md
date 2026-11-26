# Titel

m³-Liste von Stefan übernehmen: sicheres Speichern, Zeilenmessungen, Toleranzen (Aufgabe 046)

# Beschreibung

## Worum geht's

Übernahme der m³-Liste-Änderungen von Stefan (Lovable) über den Dev-Test, plus
der zugehörigen Anpassungen. Reine Dev-Dateien (Werkzeuge, Aufgabenlisten,
`CLAUDE.md`, `docs/konfig-abhaengigkeiten.md` usw.) sind bewusst nicht dabei.
`.github/workflows/release.yml` und `package-lock.json` sind unverändert.

## Änderungen (15 Dateien)

- **Sicheres Speichern der m³-Liste:**
  - Beim Speichern wird geprüft, ob die Liste zwischenzeitlich geändert wurde
    (Zeitstempel). Dann kommt eine klare "Speicherkonflikt"-Meldung statt
    stilles Überschreiben. Eingaben bleiben erhalten.
  - Der Vergleich passt auch bei großen Listen (getestet bis 100 Zeilen).
  - Die Liste wird erst angezeigt, wenn alle Daten geladen sind.
- **Zeilenmessungen:** Jede m³-Zeile kann eigene Messungen und eine Bemerkung
  haben. Beides erscheint im PDF und im Ausdruck. Die automatische Nachrüstung
  (Retrofit) stoppt bei Zeilen mit eigener Auswahl und meldet "prüfen".
- **Toleranzen:** Längen-, Querschnitt- und Innenwandtoleranz sind jetzt
  eigene, frei änderbare Werte mit Eingabeprüfung.
- **Zahlenfelder** der Liste nehmen Dezimalkomma als Text an.
- **Wiederholungsblöcke** (alle Formulare): Zeilen bekommen eine feste Kennung,
  Auffüllen und Entfernen arbeiten mit dem aktuellen Stand.
- Neue und angepasste Tests; Eintrag in `roadmap.md`.

## Hinweis für Stefan

**Toleranzen bestehender m³-Listen kommen künftig aus der Freigabe.**
Listen, bei denen früher eine Toleranzvariante oder freie Toleranzen gewählt
waren, behalten ihre bisherigen Werte. Bei allen anderen Listen werden die
drei Toleranzen einmalig aus der Produktionsfreigabe übernommen (bisher feste
Standardwerte). Fehlt dort ein Wert, bleibt das Feld leer und kann von Hand
eingetragen werden. Danach sind die Werte unabhängig von der Freigabe. Die
Zuordnung "Querschnitt-Toleranz der Freigabe → Durchmessertoleranz der Liste"
gilt als fachliche Annahme.

## Was nicht dabei ist

- Keine Änderung an der Datenbank-Struktur (keine Migrationen). Der Zeitstempel
  wird von einer bereits vorhandenen Datenbank-Regel gesetzt.
- Kein `types.ts`, keine Workflows, keine Versionsnummer (der Commit
  `1c648470` ist bewusst nicht dabei).
- Keine `.env`, keine CSV/TXT, nichts aus "protokoll changes".

## Prüfung

- Speichern gegen die Dev-Datenbank getestet: 10, 30 und 100 Zeilen, erneut
  speichern, Konfliktfall und Speichern nach Auftragsverknüpfung ohne
  Fehlalarm.
- Test-Runner im Prod-Klon: GRÜN. 2249 von 2249 Tests bestanden,
  Typprüfung ohne Fehler.
- Reviewer im Prod-Klon: APPROVED. Der Diff gegen `main` besteht aus genau
  15 Dateien, die dem geprüften Dev-Stand entsprechen. Keine Funde.

## Nach dem Merge

Der Lauf "Build & Release" startet automatisch und erzeugt die nächste
Version (ohne "bump version"-Commit). In der m³-Liste Speichern, Zeilendialog,
Toleranzen und Druck kurz prüfen.
