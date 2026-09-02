---
name: Geometrie-, Zelligkeits- und Auslegungsberechnung
description: Zentrale Berechnungsdefinitionen für AP, ε, Bauteillänge, AV/SV/FR sowie Zelligkeitsempfehlung aus Stammdaten
type: feature
---

- Zentrale Definitionen in `src/lib/geometry/calculations.ts` (`GEOMETRY_CALCULATIONS`); Auswertung ausschließlich über die bestehende Formel-Engine. Keine Rechenlogik in UI-Komponenten, keine Duplikate.
- Formeln (fachlich vorgegeben, nicht ändern): AP, ε = AP·d/4/10, l = (1,8/(AV·Z·(d/1000)·4))·1000, innere Fläche = 4·Z·d/1000·l/1000, AV = FR/innere Fläche, AV = SV/AP, SV = AV·AP, FR = AV·innere Fläche.
- Wertarten strikt getrennt: `*_soll` (Auftraggebervorgabe), `*_ist` (gemessen), `*_berechnet`. Eine Berechnung überschreibt niemals eine Vorgabe; gemessene Zelligkeit bleibt bei einer Empfehlung unverändert.
- Fehlende Eingangsgrößen ⇒ `null` plus Hinweistext („… kann nicht berechnet werden: X fehlt.“), niemals 0.
- Modusbestimmung automatisch: AV vorgegeben → Länge; FR vorgegeben → innere Fläche → AV → SV; SV vorgegeben → AV = SV/AP.
- Widersprüchliche Vorgaben werden nur gemeldet (Toleranz standardmäßig ±2 %), nie automatisch gelöst.
- Zelligkeiten und Reaktorgeometrien sind Stammdaten-Kategorien (`global_lists`, analog Mundstücke): `zelligkeiten` (Attribut `zellenzahl`) und `reaktorgeometrien` (`breite_mm`, `hoehe_mm`; Standard 30×30 mm, SOx 35×35 mm). Zugriff via `src/lib/geometry/masterData.ts`. Empfehlungen dürfen nur aus aktiven Stammdaten stammen.
- Formulardesigner: Berechnungen werden über die Schaltfläche „Vorlage“ in `LocalCalculationsPanel` als lokale Berechnung übernommen; Felder kommen über die bestehende Feldverknüpfung. Bestehende Formulare werden nicht automatisch verändert.
- Abnahmetests: `src/test/geometryCalculations.test.ts` (A–L).
