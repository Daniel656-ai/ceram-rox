# No-Code Service Designer – Stufenplan

Das ist ein sehr umfangreicher Umbau (vergleichbar mit einem Mini-Power-Apps innerhalb von Ceram ROX). Ein einzelner Wurf wäre weder seriös schätzbar noch testbar. Ich schlage einen **gestaffelten Aufbau in 6 Phasen** vor – jede Phase ist eigenständig nutzbar und baut auf der vorherigen auf.

Vor der Umsetzung bitte ich um eine Freigabe der Phasen-Reihenfolge und ein paar Detail-Entscheidungen weiter unten.

---

## Phasen-Überblick

### Phase 1 – Fundament „Service Designer Shell" + Datenmodell
- Neue Admin-Seite `/admin/services/:id/designer` mit Tab-Layout: **Allgemein · Datenmodell · Formular · Workflow · Regeln · Dokumente · Vorschau · Versionen** (Tabs zunächst teilweise als „Coming soon").
- Tab **Allgemein**: bestehende Stammdaten (Name, Kategorie, Stundensatz, Dauer, Aktiv) + neue Felder Icon, Farbe, Beschreibung, verantwortliche Abteilung.
- Tab **Datenmodell**: neuer zentraler Field-Editor (ersetzt langfristig den `ServiceParameterEditor`).
  - Datentypen: text, longtext, number, decimal, percent, date, time, datetime, boolean, select, multiselect, file, image, barcode, qrcode + Spezialtypen (kunde, material, produkt, maschine, mitarbeiter, standort, charge, serien_nr) als FK-Lookups.
  - Pro Feld: Anzeigename, interner Schlüssel (auto-slug, eindeutig pro Service), Beschreibung, Kategorie, Einheit, Pflicht, Default, Min/Max, Nachkommastellen, readonly, archiviert.
  - Beziehungen 1:n als eigener Feldtyp „repeater/subtable".
- Datenbank: neue Tabelle `service_data_fields` (ersetzt schrittweise `service_parameter_definitions`, alte Tabelle bleibt zunächst parallel für Migration).

### Phase 2 – Formular-Designer (Drag & Drop)
- Neuer Tab **Formular** mit 3-Spalten-Layout: Komponentenbibliothek · Canvas · Eigenschaften.
- Layout-Komponenten: Überschrift, Hinweis, Trennlinie, Container, Karte, Tabs, Akkordeon, 1/2/3-Spalten-Grid.
- Feld-Komponenten: nur Felder aus dem Datenmodell – keine Ad-hoc-Felder.
- Eigenschafts-Panel: Label override, Hilfetext, Breite, Sichtbarkeitsregel, Pflicht override, Default override.
- Persistenz: `service_form_layouts` (JSON-Tree pro Zielansicht: auftraggeber / mitarbeiter / mobile / pdf).
- Renderer: neuer `DynamicFormRenderer` ersetzt `DynamicParameterForm` im Auftrags-Bereich.

### Phase 3 – Workflow-Designer
- Neuer Tab **Workflow**: Liste von Phasen → Aufgaben (Drag-and-Drop, eingerückt).
- Aufgabenfelder: Name, Beschreibung, Rolle, Dauer, Priorität, Pflicht, Checkliste, Anhänge, benötigte Datenfelder.
- Persistenz: `service_workflow_phases` + `service_workflow_tasks`.
- Beim Anlegen einer Messung/Auftrag werden Tasks automatisch instanziiert (`order_workflow_tasks`).

### Phase 4 – Regeln & Automatisierungen
- Visueller WENN/DANN-Editor (Bedingungsbaum + Aktionsliste).
- Bedingungen: Feldvergleiche, Status, Rolle.
- Aktionen: Feld ein-/ausblenden, Pflicht setzen, Wert berechnen, Aufgabe erzeugen, Benachrichtigung senden.
- Persistenz: `service_rules` (JSON-Regelbaum).
- Engine: client-seitig im Formular-Renderer, server-seitig nur für Benachrichtigungen/Tasks.

### Phase 5 – Dokumente, Vorschau, Bibliothek
- Tab **Dokumente**: Datei-Vorlagen pro Service (Arbeitsanweisung, SDB, PDF-Templates) mit Platzhaltern aus dem Datenmodell.
- Tab **Vorschau**: schaltbare Ansichten Auftraggeber / Mitarbeiter / Mobile / PDF mit Demo-Daten.
- Globale **Bausteinbibliothek** (`reusable_blocks`): Field-Gruppen (z.B. „pH-Messung", „Fotos & Bemerkungen") per Drag-and-Drop einfügbar.

### Phase 6 – Versionierung & Migration
- Tab **Versionen**: jede Veröffentlichung erzeugt einen Snapshot von Datenmodell + Formular + Workflow + Regeln + Dokumenten.
- Bestehende Aufträge behalten ihre Snapshot-Version; neue Aufträge nutzen die aktuell publizierte.
- Migrationsskript: bestehende `service_parameter_definitions` → `service_data_fields` + Default-Formularlayout aus `parameter_category`/`sort_order` ableiten.
- Alter `DynamicParameterForm` wird per Feature-Flag durch `DynamicFormRenderer` ersetzt; nach erfolgreicher Migration entfernt.

---

## Technische Eckpunkte

- Alles über die zentrale API-Schicht `src/lib/api/serviceDesigner.ts` (kein direkter Supabase-Zugriff in Komponenten).
- Drag-and-Drop: `@dnd-kit` (passt zu React 18, bereits genutzte Patterns).
- Regel- und Formular-Definitionen als versionierte JSON-Strukturen in Postgres (`jsonb`), mit Zod-Schemas auf Client und in Edge-Functions.
- Berechtigungen: alle neuen Admin-Flächen hinter `services.manage` (bestehender Permission-Key) bzw. neuem `services.design` falls feiner gewünscht.
- RLS: neue Tabellen mit GRANTs + Policies analog zu bestehenden Service-Tabellen.
- Performance: Layout-/Regelbaum als ein Dokument laden, nicht viele Einzel-Queries.

---

## Aufwand (Größenordnung)

| Phase | Inhalt | Aufwand |
|---|---|---|
| 1 | Shell + Datenmodell-Editor + neue Tabelle | mittel |
| 2 | Formular-Designer + Renderer | groß |
| 3 | Workflow-Designer + Task-Instanziierung | groß |
| 4 | Regel-Engine | groß |
| 5 | Dokumente, Vorschau, Bibliothek | mittel |
| 6 | Versionierung + Migration + Cleanup | mittel |

Realistisch: pro Phase 1–2 Iterationen, mit Tests und Feedback dazwischen.

---

## Fragen vor dem Start

1. **Reihenfolge**: Phase 1 → 6 wie oben, oder soll z.B. der Workflow-Designer vor dem Formular-Designer kommen?
2. **Scope „Spezialtypen"**: Kunde/Material/Produkt/Maschine/Mitarbeiter/Standort – existieren in der DB schon Maschinen/Standort/Produkt als eigene Tabellen oder müssen die erst angelegt werden? (Aktuell sehe ich `raw_materials`, `workstations`, `profiles`, `storage_locations`, aber keine `customers`/`products`.)
3. **Bestehende Aufträge**: sollen alte Aufträge ihre alten Parameter-Definitionen behalten (Snapshot) oder hart auf das neue Modell migriert werden?
4. **Erstes sichtbares Ergebnis**: Soll ich nach Freigabe direkt mit **Phase 1** starten (Shell + Datenmodell-Editor), damit du frühestens etwas Anfassbares hast?

Sobald du die Phasen-Reihenfolge bestätigst und die 4 Fragen beantwortest, lege ich mit Phase 1 los.
