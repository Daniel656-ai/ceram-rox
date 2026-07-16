## Ziel
Die Formular-Bibliothek im Service-/Prozess-Designer erhält je Formular einen vollwertigen Layout-Designer (Drag & Drop) zusätzlich zur bestehenden Feldverwaltung – so wie es in der früheren Version verfügbar war. Felddefinition (Datenstruktur) und Layout (Darstellung) bleiben getrennt.

## Ansatz
Wir bauen keine neue Datenstruktur, sondern nutzen die bereits vorhandenen Felder:
- `form_definitions.layout` (JSONB) – speichert das Layout je Formular
- `form_fields` – bleibt Quelle der Feld-Definitionen (Typ, Pflicht, Validierung)

Der bestehende service-basierte `FormDesigner.tsx` dient als Vorlage; er wird zu einer form-basierten Variante adaptiert und in `FormsLibrary` eingebunden.

## Umsetzung

1. **Layout-Schema** (`src/lib/api/formDefinitionLayout.ts`, neu)
   - Types: `LayoutNode` (union): `section | group | tabs | columns | container | divider | heading | note | field`
   - Gemeinsame Props: `id`, `visible`, `width` (12/9/8/6/4/3), `className`, `title`, `description`
   - Root: `{ nodes: LayoutNode[] }`

2. **FormLayoutDesigner-Komponente** (`src/components/ServiceDesigner/FormLayoutDesigner.tsx`, neu)
   - Dreispaltiges Layout:
     - **Links (Palette)**: Layout-Bausteine (Abschnitt, Gruppe, Tabs, Spalten 1/2/3, Container, Trennlinie, Überschrift, Hinweistext) + Liste noch nicht platzierter Felder aus `form_fields`
     - **Mitte (Canvas)**: Drag & Drop Baum mit `@dnd-kit` (Sortable + Droppable), verschachtelbar
     - **Rechts (Inspector)**: Eigenschaften des selektierten Knotens (Titel, Sichtbarkeit, Breite, CSS-Klassen, Beschreibung, Feld-Override-Label)
   - Live-Vorschau via bestehende Render-Logik (siehe Punkt 4)
   - "Zurücksetzen", "Speichern" (schreibt `form_definitions.layout`), Änderungs-Indikator

3. **FormsLibrary erweitern** (`src/components/ServiceDesigner/FormsLibrary.tsx`)
   - Beim Klick auf ein Formular öffnet sich ein Vollbild-Editor (Dialog oder Sub-Route) mit Tabs:
     - **Felder** – bestehende Feldverwaltung (bereits vorhanden bzw. via `form_fields` API)
     - **Layout** – neuer `FormLayoutDesigner`
     - **Vorschau** – reine Read-only Ansicht des gerenderten Layouts
   - Meta-Bearbeitung (Name, Typ, Global) bleibt als kleiner Dialog erhalten

4. **Renderer** (`src/components/ServiceDesigner/FormLayoutRenderer.tsx`, neu)
   - Rendert `LayoutNode[]` als tatsächliches Formular (readonly Vorschau + wiederverwendbar in Runtime)
   - Nutzt Tailwind-Grid (`grid-cols-12`) für Spaltenbreiten
   - Unbekannte / unbenutzte Felder werden nicht gerendert (bleiben in Bibliothek)

5. **API** (`src/lib/api/formDefinitions.ts`)
   - Ergänzung: `saveLayout(id, layout)` – dünner Wrapper um `update`

## Technische Details
- Drag & Drop: `@dnd-kit/core` + `@dnd-kit/sortable` (bereits im Projekt in Verwendung)
- Verschachtelte Sortables: eigener rekursiver `LayoutNodeItem`, `useSortable` je Knoten, `useDroppable` für Container/Section/Tab/Column/Group
- State: lokal via `useState` + `useMutation` fürs Speichern; Dirty-Tracking via Referenzvergleich
- Keine DB-Migration nötig – `form_definitions.layout jsonb` existiert bereits
- Bestehender service-basierter `FormDesigner` bleibt unverändert (rollen-spezifische Views auf Service-Ebene)

## Nicht enthalten
- Änderungen an Runtime/Ausführung von Formularen (nur Vorschau)
- Migration existierender Service-Layouts in die Formular-Ebene