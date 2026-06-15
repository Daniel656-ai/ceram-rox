# Mischungen und Lösungen

Neuer eigenständiger Hauptbereich, fachlich getrennt von Rohstoffen, nutzt diese aber als Ausgangsstoffe. Jede Mischung hat eine Rezeptur (n Rohstoffe), eine Herstellung erzeugt eine Charge, bucht Rohstoffe aus und Mischungsbestand ein und schreibt ein revisionssicheres Protokoll.

## Datenmodell (neue Tabellen)

1. **mixtures** — Stammdaten einer Mischung/Lösung
   - `name`, `mixture_number` (optional, frei änderbar wie bei Rohstoffen), `description`, `category` (`mischung` | `loesung`), `unit` (kg/l/g), `target_concentration` (nullable), `is_active`, `created_by`

2. **mixture_recipe_items** — Rezeptur (n Rohstoffe pro Mischung)
   - `mixture_id`, `raw_material_id`, `quantity`, `unit`, `position`, `notes`
   - Mengen werden später proportional zur Herstellungsmenge skaliert.

3. **mixture_batches** — Herstellungsprotokoll / Charge
   - `mixture_id`, `batch_number` (Format `MIXYYNNNN`, advisory-lock generiert), `produced_at`, `produced_by`, `produced_quantity`, `unit`, `concentration` (nullable), `notes`, `status` (`produced` | `discarded`)

4. **mixture_batch_consumptions** — verwendete Rohstoffchargen pro Herstellung (Traceability)
   - `mixture_batch_id`, `raw_material_id`, `raw_material_batch_id` (nullable), `quantity`, `unit`

5. **mixture_inventory_movements** — Bestandsbewegungen der Mischungen (analog `inventory_movements`)
   - `mixture_id`, `mixture_batch_id`, `movement_type` (`eingang`|`ausgang`), `quantity`, `movement_date`, `comment`, `created_by`

Alle Tabellen: RLS aktiv, `GRANT` für `authenticated` + `service_role`, `updated_at`-Trigger, Policies nutzen `has_permission` analog `raw_materials`.

## Geschäftslogik (DB)

- Trigger `generate_mixture_batch_number` mit `pg_advisory_xact_lock` (analog Sample/Measurement).
- RPC `produce_mixture_batch(mixture_id, quantity, concentration, notes, consumptions[])`:
  - Erstellt `mixture_batches` Eintrag
  - Schreibt für jede `consumption` einen `inventory_movements` `ausgang` auf den Rohstoff (und optional Charge) **und** einen Eintrag in `mixture_batch_consumptions`
  - Schreibt einen `mixture_inventory_movements` `eingang` über die hergestellte Menge
  - Alles in einer Transaktion → vollständige Rückverfolgbarkeit, kein Teilzustand.
- Aktivitätslog: Event `mixture_batch_produced` in `activity_log`.

## API Layer (`src/lib/api/`)

- `mixtures.ts` — list/get/create/update/delete
- `mixtureRecipes.ts` — list/add/update/delete Rezeptpositionen
- `mixtureBatches.ts` — list/get + `produce()` (ruft RPC)
- `mixtureInventory.ts` — Bewegungen + Bestand
- Registrierung in `src/lib/api/index.ts`

## Hooks (`src/hooks/useMixtures.ts`)

React-Query Hooks für alle obigen API-Funktionen inkl. Cache-Invalidierung von Rohstoff-Beständen nach Herstellung.

## UI / Routen

- `/mischungen` → `MixturesPage` (Liste: Name, Nummer, Kategorie, akt. Bestand, letzte Charge)
- `/mischungen/neu` → Anlegen (Stammdaten + Rezeptur in einem Schritt)
- `/mischungen/:id` → `MixtureDetailPage` mit Tabs:
  - **Rezeptur** (editierbar)
  - **Herstellung** (Dialog „Charge herstellen": Menge, Konzentration, Chargenauswahl pro Rohstoff, Validierung gegen Lagerbestand)
  - **Chargen / Protokolle** (Tabelle aller `mixture_batches` inkl. Verbrauch)
  - **Bestandsbewegungen**
- Sidebar: neuer Eintrag „Mischungen & Lösungen" (Icon `FlaskRound`/`Beaker`-Variante), Sichtbarkeit über bestehende Berechtigung `raw_materials.manage` ODER neue `mixtures.manage` (vorerst an `raw_materials.manage` gekoppelt, erweiterbar).
- App-Routing in `src/App.tsx` registrieren.
- i18n DE/EN Dateien `mixtures.json`.

## Trennung von Rohstoffen

- Eigene Tabellen, eigene Seiten, eigener Sidebar-Eintrag.
- Rohstoff-Liste/Detail bleibt unverändert; Mischungen tauchen dort nicht als Material auf.
- Verbrauch der Rohstoffe läuft über die bestehende `inventory_movements`-Tabelle (Konsistenz mit aktueller Bestandsanzeige) — Rohstoff-UI bleibt aufgeräumt, da nur Bewegungen erscheinen, keine neuen Stammdaten.

## Akzeptanzkriterien-Abdeckung

- Rezeptur mit n Rohstoffen ✔ (`mixture_recipe_items`)
- Herstellung bucht Rohstoffe ab + Mischungsbestand auf ✔ (RPC, transaktional)
- Protokoll mit Verantwortlichem, Datum, Charge, Konzentration, Rohstoffchargen ✔ (`mixture_batches` + `mixture_batch_consumptions`)
- Rückverfolgbarkeit ✔ (FK auf `raw_material_batches`, unveränderlicher Audit über Protokoll-Tabelle)
- Rohstoffverwaltung bleibt übersichtlich ✔ (eigener Bereich)

## Offene Punkte vor Implementierung

1. Soll die **Konzentration** ein freies Textfeld (z. B. „37 % HCl") oder numerisch + Einheit (`%`, `mol/l`) sein?
2. Sollen **Mischungen selbst wieder als Zutat** in anderen Mischungen verwendet werden können, oder nur Rohstoffe?
3. Berechtigungen: reicht vorerst **`raw_materials.manage`** für Anlegen und Herstellen, oder soll ich gleich eine eigene Permission `mixtures.manage` einführen?