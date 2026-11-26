# Titel

Release: Versionsnummer ohne "bump version"-Commit auf main (Aufgabe 041)

# Beschreibung

## Worum geht's

Bisher hat der Ablauf "Build & Release" bei jedem Lauf einen eigenen Commit
("chore: bump version to vX.Y.Z") auf `main` geschrieben. Das entfällt.

## Was ändert sich

Nur die Datei `.github/workflows/release.yml`:

- Die neue Version wird aus zwei Quellen bestimmt: dem neuesten Release-Tag
  (`vX.Y.Z`) und der Version in `src-tauri/tauri.conf.json`. Die höhere der
  beiden (nach Zahlen verglichen, nicht alphabetisch) bekommt +1 beim
  letzten Teil. Die Nummer kann dadurch nie sinken.
- Die Nummer wird nur im Build-Arbeitsverzeichnis in `tauri.conf.json`
  eingetragen und nicht zurück ins Repo geschrieben.
- Der Schritt "Commit version bump" ist entfernt.
- Beim Herunterladen des Codes werden jetzt alle Tags mitgeholt
  (`fetch-depth: 0`, `fetch-tags: true`), sonst fände der Lauf den
  neuesten Tag nicht.

## Was bleibt gleich

- Tag und Release heißen weiter `vX.Y.Z`, das Release wird sofort
  veröffentlicht (kein Entwurf), also entsteht der Tag gleich.
- Updater und `latest.json` funktionieren wie bisher.
- Läufe warten weiter nacheinander (`concurrency: release`), zwei Läufe
  bekommen nicht dieselbe Nummer.

## Für die Desktop-App

Für die Anwender ändert sich nichts. Nur die Zahl in `tauri.conf.json` im
Repo bleibt künftig stehen und zeigt nicht mehr die aktuelle Version. Die
aktuelle Version steht im neuesten Release-Tag.

## Prüfung

Mit den echten Daten nachgerechnet: neuester Tag `v0.1.554`,
`tauri.conf.json` `0.1.554`. Der nächste Lauf erzeugt **0.1.555**.

## Hinweis zum Merge

Erster echter Test ist der Lauf nach dem Merge. Danach prüfen: Release
`v0.1.555` ist da und es gibt keinen neuen "bump version"-Commit auf `main`.
