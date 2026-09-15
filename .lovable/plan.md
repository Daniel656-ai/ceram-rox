# Chemische Oxidnamen in der Ergebnisdatenbank einheitlich darstellen

## Analyseergebnis
- Offizielle Ergebnisse stammen aus `measurement_results`; sichtbar wird bevorzugt `display_label`, ersatzweise `result_name`.
- RFA-Messfälle und Importlogik verwenden bewusst technische, kanonische Schlüssel wie `Na2O`, `K2O`, `TiO2` und `SO3`.
- Die vorhandene Elementlogik erkennt bereits normale und tiefgestellte Schreibweisen als denselben technischen Schlüssel und kann Formeln mit tiefgestellten Ziffern darstellen.
- Die Ergebnismatrix übernimmt Bezeichnungen aus Ergebnisdefinitionen und Messdaten derzeit jedoch unverändert. Deshalb hängt die Darstellung davon ab, ob ein Anzeigename bereits formatiert gespeichert wurde: `TiO₂` und `SO₃` können korrekt erscheinen, während `Na2O` und `K2O` sichtbar technisch bleiben.
- Es ist keine Datenänderung nötig; Schlüssel, Werte, RFA-Import und Messfälle bleiben unverändert.

## Umsetzung
1. Die bestehende Elementlogik um eine reine Anzeigehilfe ergänzen: erkannte chemische Formeln werden mit tiefgestellten Ziffern angezeigt, technische Schlüssel bleiben unverändert.
2. Diese Anzeigehilfe nur an den sichtbaren Bezeichnungen der Ergebnisdatenbank und ihrer Diagramm-Auswahl verwenden.
3. Zuordnung, Suche nach Ergebniswerten, Speicherung und Exportwerte weiterhin über die bestehenden technischen Schlüssel abwickeln.

## Prüfung
- `Na2O` wird als `Na₂O`, `K2O` als `K₂O` angezeigt.
- `TiO₂` und `SO₃` bleiben korrekt.
- Technische Schlüssel bleiben `Na2O`, `K2O`, `TiO2`, `SO3` und finden weiterhin die bestehenden Messwerte.
- Tests decken sowohl technische als auch bereits formatierte Eingaben ab; vollständige Testsuite wird ausgeführt.
- Da Web und Desktop/Tauri dieselbe React-Ergebnisansicht verwenden, gilt die Darstellung in beiden Oberflächen.

## Grenzen
Keine Änderung an Messwerten, Messergebnissen, RFA-Import, Messfällen, Datenbankstruktur oder Infrastruktur.
