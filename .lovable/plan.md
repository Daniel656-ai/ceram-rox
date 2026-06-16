## Ziel

Zwei große Erweiterungen im Bereich Mischungen & Lösungen:

1. **Flexible Zeitsteuerung** für Prozessschritte, Messungen & Rohstoffzugaben (relativ, absolut, bedingungsbasiert)
2. **Rezepturvorlagen, Kopieren & Versionsvergleich** mit Änderungshistorie und Vorlagentypen

Vorschlag: Umsetzung in **2 Phasen**, weil unabhängig nutzbar und Datenmodell-Änderungen umfangreich.

---

## Phase A — Flexible Zeitsteuerung (Prozessschritte/Messungen)

### Datenbank

Erweiterung `mixture_process_steps` und `mixture_planned_measurements`:

| Spalte | Typ | Zweck |
|---|---|---|
| `time_mode` | enum `relative` \| `absolute` \| `condition` | Art der Zeitsteuerung |
| `absolute_time` | `time` | Uhrzeit bei `absolute` (z.B. 08:00) |
| `condition_kind` | enum `temperature` \| `ph` \| `previous_step` \| `manual_release` \| `custom` | Trigger-Typ |
| `condition_value` | numeric | Schwelle (80 für 80°C, 6.5 für pH) |
| `condition_unit` | text | °C, pH, … |
| `condition_text` | text | Freitext für `custom` / manuelle Freigabe |

Bestehende `offset_minutes` bleibt für `relative` (intern in Minuten gespeichert), UI bietet Eingabe als **Minuten / Stunden / Stunden+Minuten**.

### UI

- `ProcessEditor.tsx`: pro Step/Messung neuer Time-Picker mit 3 Tabs (Relativ | Uhrzeit | Bedingung)
  - Relativ: Dauer-Input mit Einheitenumschalter (min / h / h+min)
  - Uhrzeit: `<input type="time">`
  - Bedingung: Select (Temperatur/pH/vorheriger Schritt/Freigabe/Custom) + Wert/Einheit
- `BatchExecutionPage.tsx`: Anzeige der fälligen Aufgaben mit passender Darstellung
  - Live-Hinweise: Toast/Badge wenn relative Zeit erreicht oder absolute Uhrzeit überschritten
  - Bedingungs-Trigger: Button „Bedingung erfüllt → freigeben" startet nächste Schritte

### Helper

Neue Util `src/lib/processTime.ts`:
- `formatStepTime(step) → "+5 min" | "08:00" | "bei 80 °C"`
- `parseRelative(value, unit) → minutes`
- `isStepDue(step, batchStartedAt, recordedMeasurements) → boolean`

---

## Phase B — Vorlagen, Kopieren & Versionsvergleich

### Datenbank

**`mixtures`** erweitern:
- `is_template` boolean default false
- `template_kind` enum `standard` \| `customer` \| `development` \| `pilot` \| `production` \| null
- `copied_from_mixture_id` uuid nullable

**`mixture_recipe_versions`** erweitern:
- `version_label` text (`1.0`, `1.1`, `2.0` — manuell setzbar, fallback `version_no`)
- `change_summary` text (Was)
- `change_reason` text (Warum)
- `parent_version_id` uuid (vorherige Version, für Diff)

**Neue RPCs:**
- `copy_mixture(_source_id, _new_name, _new_number)` → uuid: dupliziert Mixture + aktive Version + alle items/sections/steps/measurements
- `create_mixture_from_template(_template_id, _new_name)` → uuid
- `diff_recipe_versions(_version_a, _version_b)` → jsonb mit { added/removed/changed items, sections, steps, measurements }

**Chargenbezogene Versionssicherheit**: bereits in `mixture_batches.recipe_version_id` vorhanden, wird beim Erzeugen einer neuen Version NICHT mehr verändert (Pinning).

### UI

- `MixturesPage.tsx`: 
  - Toggle „Nur Vorlagen anzeigen"
  - Button „Aus Vorlage erstellen" → Dialog (Template-Auswahl + neuer Name)
  - Pro Mischung „Duplizieren"-Action
- `MixtureDetailPage.tsx`:
  - Checkbox „Als Vorlage markieren" + Select Vorlagentyp
  - Im Versions-Bar: Felder `version_label`, `change_summary`, `change_reason` beim Erstellen
  - Neuer Button „Versionen vergleichen" → Dialog `VersionDiffDialog`
- Neue Komponente `VersionDiffDialog.tsx`:
  - 2 Select für Versionen A/B
  - Tabelle mit farbcodierten Zeilen: grün=neu, rot=entfernt, gelb=geändert
  - Sektionen: Rohstoffe, Prozessabschnitte, Schritte, Messungen

---

## Technische Hinweise

- Alle DB-Änderungen RLS-konform, GRANTs für authenticated + service_role
- API strikt über `src/lib/api/mixtureProcess.ts` und neue `src/lib/api/mixtureTemplates.ts`
- i18n DE/EN in `mixtures.json` erweitern (Zeitmodi, Vorlagentypen, Diff-Labels)
- Keine breaking changes: bestehende Steps ohne `time_mode` werden als `relative` interpretiert

## Frage vor Start

Beide Phasen jetzt zusammen umsetzen (groß, 1 Migration + ~10 Dateien), oder erst **Phase A** (Zeitsteuerung), dann nach Test **Phase B**?
