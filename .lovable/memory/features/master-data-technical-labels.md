---
name: Technische Stammdaten-Bezeichnungen
 description: Desktop-only Rich-Text-Anzeigen für Stammdaten; technische Schlüssel stabil, Web-Verhalten unverändert
 type: feature
---
Stammdaten-Kategorien, Eigenschaften, Eintragsbezeichnungen und Einheiten unterstützen in der Desktop-/Tauri-Variante die zentrale ROX-Auszeichnung `_{…}` und `^{…}`.

- `display_name`, `label` und `unit` sind reine Anzeigefelder; `list_key`, `item_value` und `attribute_key` bleiben technische, unformatierte Schlüssel.
- Die Desktop-Anzeige bildet die bestehende Eigenschaft „Zusammensetzung“ als „Volumsanteil“ ab, ohne gespeicherte Daten oder Referenzen umzubenennen.
- Häufige Gasbezeichnungen N2, H2O, CO2 und O2 werden in Desktop als N₂, H₂O, CO₂ und O₂ angezeigt; technische Werte bleiben gleich.
- `cp` und `cv` können als `c_{p}` und `c_{v}` dargestellt werden; weitere Symbole werden über den bestehenden Symbol-/Rich-Text-Editor gepflegt.
- Einheit bleibt im vorhandenen separaten Feld.
- Keine automatische Anlage fachlicher Eigenschaften, keine neue Tabelle und keine Änderung des Web-Verhaltens.
