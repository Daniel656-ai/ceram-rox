---
name: Messdaten-Import (Copy & Paste)
description: Generischer, geräteunabhängiger Import von Messdaten aus externer Messsoftware via Zwischenablage; Importprofile mit Parameter-Zuordnung
type: feature
---

- Feldtyp `measurement_import` im Formulardesigner: fügt einen Button "Messdaten einfügen" ins Formular ein.
- Importprofile in Tabelle `measurement_import_profiles` (Name, Format, Dezimaltrennzeichen, Mappings `source_names -> target_field_key`, Einheit, Faktor). Nur Designer-Berechtigte dürfen Profile pflegen, alle dürfen lesen.
- Parser `src/lib/measurementImport.ts`: erkennt Parameter/Wert-Listen sowie Tabellen (Parameter in Zeilen oder Spalten, mehrere Proben), DE/EN-Zahlenformate, Einheiten, Werte unter Nachweisgrenze ("<0,01" wird als Rohtext übernommen).
- Zuordnung: Profil zuerst, dann Namensabgleich (normalisiert: Kleinschreibung, tiefgestellte Ziffern, Sonderzeichen); manuelle Korrektur je Zeile in der Vorschau möglich.
- Geschrieben wird ausschließlich in Geschwisterfelder desselben Scopes (auch innerhalb eines Repeater-Eintrags).
- Erstes Anwendungsbeispiel: Profil "RFA" (Oxidgehalte), weiters Partikelgröße, Feuchte, Porenvolumen.
