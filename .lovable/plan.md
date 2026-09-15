# Globale Datenquelle „Konstante“

## Ziel
Die bestehende Bibliothek globaler Felder erhält additiv die Datenquelle **Konstante**. Ein zentral hinterlegter Wert wird in Web und Desktop automatisch in Formeln bereitgestellt, im Messformular schreibgeschützt angezeigt und nicht als Messwert gespeichert.

## Umsetzung
1. Das bestehende globale Feldmodell um `constant` ergänzen. Der feste Wert bleibt im vorhandenen Feld `default_value`; es gibt keine neue Tabelle oder Migration.
2. Im Editor bei „Konstante“ ein eindeutig bezeichnetes Wertefeld anzeigen. Stammdaten-, Listen- und Berechnungsoptionen bleiben ausgeblendet; Einheit und Beschreibung bleiben nutzbar.
3. Beim Einfügen eines konstanten globalen Feldes dessen Herkunft in den vorhandenen Formular-Metadaten mitführen. Die zentrale globale Definition bleibt maßgeblich, sodass spätere Wertänderungen ohne Kopierlogik wirksam werden.
4. Eine gemeinsame Auflösung für globale Konstanten ergänzen: Typgerechte Werte (insbesondere deutsche Dezimalzahlen wie `0,972`) werden zentral gelesen und in Formular- und Formelkontexte eingespeist.
5. Konstante Felder im Formular automatisch schreibgeschützt darstellen. Sie werden nicht in die Messwert-Persistierung aufgenommen; Berechnungen können sie dennoch über den stabilen Feldschlüssel verwenden.
6. Bestehende Datenquellen und die Stammdatenreferenz unverändert lassen. Keine BENCH-NOx-Formel und keine konkrete Venturi-Konstante hardcodieren.

## Prüfung
- Automatisierte Tests für `C = 0,972`, typgerechte Auflösung, Formelauswertung und Schreibschutz-/Persistierungsfilter.
- Bestehende Tests vollständig ausführen und Typprüfung durchführen.
- Webansicht sowie Desktop/Tauri-Buildpfad auf unverändertes Verhalten bestehender Quellen prüfen.

## Technische Grenzen
- Keine Backend-Adresse, Datenbankstruktur, Storage-, Edge-Function-, Auth- oder Secret-Änderung.
- Keine Migration bestehender globaler Felder.
- Technische Schlüssel bleiben stabil; `epsilon_venturi` bleibt fachlich getrennt vom Geometrie-Schlüssel `epsilon`.
