# Desktop: technische Stammdaten-Bezeichnungen

## Ziel
Das bestehende Stammdaten-/Eigenschaften-System wird ausschließlich in der Desktop-/Tauri-Oberfläche um eine konsistente Hoch-/Tiefstellung für Bezeichnungen und Einheiten ergänzt. Technische Schlüssel und gespeicherte Werte bleiben unverändert.

## Umsetzung
1. Die vorhandene zentrale Rich-Text-Schreibweise (`_{…}` / `^{…}`) in der Desktop-Stammdatenpflege für Eigenschaften, Eintragsbezeichnungen und Einheiten verfügbar machen.
2. Bezeichnungen und Einheiten in den Desktop-Stammdatentabellen und Dialogen mit derselben zentralen Darstellungslogik rendern; die Webansicht behält ihre bisherige Eingabe und Darstellung.
3. Die vorhandene Bezeichnung „Zusammensetzung“ in der Desktop-Anzeige als „Volumsanteil“ darstellen, ohne den technischen `attribute_key` oder bestehende Referenzen/Formeln umzubenennen.
4. Sicherstellen, dass Eigenschaften weiterhin frei definierbar bleiben und Symbole wie `M`, `y_{i}`, `ρ`, `w_{i}`, `R`, `c_{p}`, `c_{v}` und `κ` als Anzeige gepflegt werden können. Einheit bleibt im bestehenden separaten Feld.
5. Tests für chemische Formeln, technische Symbole, stabile Schlüssel und die Desktop-only-Anzeige ergänzen; bestehende Stammdatenreferenz-Tests weiterverwenden.

## Technische Details
- Keine Tabellen, Migrationen, neuen Stammdatenstrukturen oder Backend-Änderungen.
- Keine automatische Anlage der acht Eigenschaften; sie werden weiterhin im vorhandenen Eigenschaften-System gepflegt.
- Gespeicherte technische Schlüssel (`attribute_key`, `item_value`) werden nie aus der formatierten Anzeige überschrieben.
- Globale Variablen referenzieren weiterhin eindeutig über Kategorie-, Eintrags- und Eigenschaftsschlüssel.
- Die Desktop-Abgrenzung erfolgt über die vorhandene Laufzeiterkennung; Web-Verhalten bleibt unverändert.

## Prüfung
- Bestehende Eigenschaften und Schlüssel bleiben unverändert.
- „Zusammensetzung“ erscheint im Desktop als „Volumsanteil“.
- `N_{2}`, `H_{2}O`, `CO_{2}`, `O_{2}`, `c_{p}`, `c_{v}`, `y_{i}` und `w_{i}` werden korrekt dargestellt.
- Neue und bestehende Stammdatenreferenzen bleiben eindeutig auflösbar.
- Relevante Tests sowie die automatische Projektprüfung laufen erfolgreich.
