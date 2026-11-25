# Aufgabe 003: Server-Update der Dev-Umgebung automatisieren

## Ziel
Auf dem Firmenserver (172.30.100.162, kein Internet) soll **ein** Skript alle 10 Minuten die komplette
Dev-Umgebung aktuell halten – nicht nur die Web-Vorschau, sondern auch den Projektordner mit den Skripten.
Heute aktualisiert `scripts/dev-web/update-dev-web.ps1` nur den Branch `dev-web`.

## Ausgangslage am Server (bitte lesen, nicht ändern)
- Projektordner (Klon von `main` aus Gitea): `C:\Users\Daniel.Gass\Ceram_Rox\ceram-rox-dev`
- Web-Vorschau (Klon des Branches `dev-web`): `C:\Users\Daniel.Gass\Ceram_Rox\ceram-rox-dev-web`
- Gitea-Remote: `http://atfrt-git:3000/daniel.gass/ceram-rox-dev.git` (Pull-Mirror von GitHub)
- Aufgabenplanung:
  - „Dev-Web Update“ – alle 10 Min., ruft `scripts\dev-web\update-dev-web.ps1` auf
  - „Dev-Web Server“ – startet `scripts\dev-web\serve-dev-web.py` (Flask, Port 8090) bei Anmeldung
- **Wichtig:** Im Projektordner ist `supabase/config.toml` lokal mit Dev-Ports (553xx) angepasst und per
  `git update-index --skip-worktree` markiert. Ändert sich diese Datei im Repo, schlägt `git pull` fehl.
- Windows PowerShell 5.1, Python 3.13 unter `C:\Program Files\Python313\python.exe`.
- Die **Produktion** liegt daneben in `C:\Users\Daniel.Gass\Ceram_Rox\ceram-rox` und darf von keinem
  Skript dieser Aufgabe angefasst werden.

## Umfang

### 1. `update-dev-web.ps1` erweitern (Name und Aufgabenplanung bleiben gleich)
Reihenfolge pro Lauf:
1. **Projektordner aktualisieren:** `git fetch` + `git pull --ff-only` in `ceram-rox-dev`.
   - Vorher Hash von `scripts/dev-web/serve-dev-web.py` merken.
   - Schlägt der Pull fehl (z. B. weil sich `supabase/config.toml` im Repo geändert hat):
     klare Meldung ins Log, z. B. „config.toml hat sich im Repo geändert – Dev-Ports bitte manuell
     übertragen (siehe README)“, **nichts zurücksetzen oder überschreiben**, mit Schritt 3 weitermachen.
2. **Server neu starten, wenn nötig:** Hat sich der Hash von `serve-dev-web.py` geändert,
   Aufgabe „Dev-Web Server“ stoppen und wieder starten und das ins Log schreiben.
3. **Web-Vorschau aktualisieren:** wie bisher `git fetch` + `git reset --hard origin/dev-web`
   in `ceram-rox-dev-web`.
4. Platzhalter/Haken für einen späteren Schritt „Dev-Datenbank synchronisieren“ (Aufgabe 004) vorsehen,
   aber noch nichts tun.

Ein Fehler in einem Schritt darf die anderen nicht verhindern. Jeder Schritt schreibt eine kurze Zeile ins Log.

### 2. Sicherheitsprüfungen im Skript
- Vor jedem Git-Befehl prüfen, dass der Zielordner wirklich `ceram-rox-dev` bzw. `ceram-rox-dev-web`
  ist und der Remote auf `daniel.gass/ceram-rox-dev` zeigt. Sonst Abbruch dieses Schritts mit Log-Eintrag.
- Niemals `git reset --hard`, `git clean` oder `git checkout --` im Projektordner `ceram-rox-dev`
  (dort liegen lokale Anpassungen). `reset --hard` nur im Web-Ordner.

### 3. `.gitignore`
- `scripts/dev-web/update-dev-web.log` ignorieren (die Datei entsteht am Server im Repo-Ordner).

### 4. README `scripts/dev-web/README.md`
- Kurz beschreiben, was das Update jetzt alles macht.
- Abschnitt „Wenn sich `supabase/config.toml` im Repo ändert“: wie man die Änderung übernimmt und die
  Dev-Ports wieder einträgt (inkl. `git update-index --no-skip-worktree` / `--skip-worktree`).

## Nicht ändern
- `src/`, `supabase/`, `drizzle/`, `.env`, `release.yml`, `dev-web.yml`, `serve-dev-web.py`
- Keine Secrets in Dateien.

## Fertig, wenn
- Skript ist PowerShell-5.1-kompatibel und in sich stimmig (Pfade, Aufgabennamen)
- Fehlerfälle (Pull-Fehler, Ordner fehlt) sind abgefangen und landen im Log
- Reviewer hat APPROVED gemeldet
- Zusammenfassung enthält, was Daniel am Server von Hand prüfen soll
