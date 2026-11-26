# 029b: Konfigurationstabellen, die Benutzer über die Oberfläche ändern

Stand: 2026-11-24, Dev-`main` (b8abe423). Nur Analyse, am Code und an der Datenbank nichts geändert.

**Quelle:** Schreibzugriffe (`insert`/`update`/`upsert`/`delete`) in `src/lib/api` und `src/hooks`, Spalten aus `src/integrations/supabase/types.ts` (das ist der Stand der Prod-/Lovable-Struktur, nicht der Dev-DB). Zuordnung zur Oberfläche aus den Seiten und Designer-Komponenten.
**Weggelassen:** Benutzer, Rollen, Rechte (`profiles`, `user_*`, `custom_roles`, `role_permissions`), Aufträge, Proben, Messwerte, Projekte, Berichte, Chargen und Container.

**Spalten:** `ca` = created_at, `ua` = updated_at, `cb` = created_by, `ub` = updated_by (ja/–). `Erg.` = Auswirkung auf Ergebnisdatenbank, `Abl.` = Auswirkung auf Abläufe (Auftrag, Messung, Workflow). Die Wirkung ist aus Spaltennamen und Code abgeleitet („ja?" = wahrscheinlich, nicht im Detail geprüft).

**Kernaussage zur Nachvollziehbarkeit:** Fast alle Tabellen werden direkt überschrieben, es gibt keinen Verlauf. Echte Versionen haben nur `service_versions` (Versionsverlauf der Dienstleistung, Designer „Versions") und `mixture_recipe_versions` (Rezepte). `form_definition_versions` steht nur in `types.ts`, im Code wird sie nicht benutzt. „Änderer" (`ub`) gibt es nur bei wenigen Tabellen. Gelöscht wird meist endgültig.

## 1. Dienstleistungs-Designer (`AdminServiceDesignerPage` und Tabs)

| Tabelle | Oberfläche | ca | ua | cb | ub | Erg. | Abl. |
|---|---|---|---|---|---|---|---|
| `measurement_services` | Dienstleistungen anlegen/archivieren (AdminServicesPage, Designer) | ja | ja | – | – | ja (Ergebnisse hängen an der Dienstleistung) | ja |
| `service_data_fields` | Datenfelder der Dienstleistung (Designer: Felder; `is_result`, Rechenfelder) | ja | ja | ja | – | **ja** (Ergebnisfelder, Einheiten) | ja |
| `service_blocks` | Messdatenblöcke / Blockvorlagen (Designer) | ja | ja | ja | – | ja? | ja |
| `service_field_templates` | Feldvorlagen (Designer) | ja | ja | ja | – | ja? | nein |
| `service_forms` | klassische Dienstleistungsformulare (inkl. Workflow-Designer) | ja | ja | ja | – | ja? | ja |
| `service_form_links` | Verknüpfung Dienstleistung ↔ Formular (FormDesigner/RoleForm) | ja | ja | – | – | **ja** (welches Formular Ergebnisse liefert) | ja |
| `service_form_layouts` | Rollenlayout der Dienstleistung (RoleViewsDesigner) | ja | ja | – | ja | nein | ja (Darstellung) |
| `service_document_templates` | Berichts-/Dokumentvorlagen (ReportTemplateDesigner, DocumentsDesigner) | ja | ja | – | ja | nein | nein (Berichte) |
| `service_rules` | Regeln (RulesDesigner, Trigger/Bedingungen) | ja | ja | – | ja | ja? | ja |
| `service_versions` | Versionsverlauf der Dienstleistung (VersionsDesigner), **einzige echte Versionierung** | ja | – | ja | – | nein | nein |
| `service_workflows` | Dienstleistung ↔ Workflow-Zuordnung | ja | ja | – | ja | nein | **ja** |
| `service_workflow_definitions` | Workflow-Definitionen (WorkflowDesigner), mit `version` | ja | ja | ja | – | nein | **ja** |
| `service_workflow_steps` | Workflow-Schritte (WorkflowStepsDesigner) | ja | ja | – | – | nein | **ja** |
| `service_workflow_step_services` | Dienstleistungen je Workflow-Schritt | ja | – | – | – | nein | **ja** |
| `service_parameter_definitions` | Parameter-/Elementlisten der Dienstleistung | – | – | – | – | **ja** (Parameter, Einheiten) | ja |
| `mdl_service_permissions` | wer eine Dienstleistung ausführen darf (Berechtigung je Labor/Messplatz) | – | – | – | – | nein | ja |
| `process_templates` | Prozessvorlagen (AdminServicesPage / WorkflowProcessesTab), mit `version` | ja | ja | ja | – | nein | ja |
| `process_steps` | Schritte der Prozessvorlagen | ja | ja | – | – | nein | ja |
| `process_step_raw_materials` | Rohstoffe je Prozessschritt | ja | ja | – | – | nein | nein |
| `service_packages` | Servicepakete (AdminServicePackagesPage) | ja | ja | ja | – | nein | ja (Auftragsanlage) |
| `service_package_items` | Inhalt der Servicepakete | ja | ja | – | – | nein | ja |

## 2. Formulare und globale Bibliothek (FormDesigner, RoleFormTab, GlobalLibraryTab, GlobalModelTab, MasterDataPage)

| Tabelle | Oberfläche | ca | ua | cb | ub | Erg. | Abl. |
|---|---|---|---|---|---|---|---|
| `form_definitions` | Formulare, Layout (FormDesigner, FormLayoutDesigner); Spalte `version` wird nicht hochgezählt | ja | ja | ja | – | **ja** (Formular liefert Ergebnisse) | ja |
| `form_fields` | Felder, inkl. Ergebnis-Kennzeichen (`is_result`, `result_label`) | ja | ja | – | – | **ja** | ja |
| `form_calculations` | Berechnungen im Formular | ja | ja | ja | – | **ja** (Rechenwerte = Ergebnisse) | ja |
| `form_field_permissions` | Feldrechte je Rolle | ja | ja | – | – | nein | ja (wer sieht/ändert) |
| `form_role_views` | Rollenansichten (RoleViewsDesigner) | ja | ja | ja | ja | nein | ja (Darstellung) |
| `order_kind_form_templates` | Auftragsart → Formular (OrderKindMappingTab) | ja | ja | – | ja | ja? | **ja** (welches Formular bei welcher Auftragsart) |
| `global_objects` | Globale Objekte (GlobalModelTab) | ja | ja | ja | – | ja? | nein |
| `global_fields` | Globale Felder, mit `version` (GlobalModelTab, GlobalFieldPicker) | ja | ja | ja | – | **ja** (Feldnamen/Einheiten für Ergebnisse) | ja |
| `global_lists` | Auswahllisten (GlobalLibraryTab, MasterDataPage) | ja | ja | ja | – | ja? | ja |
| `global_list_items` | Einträge der Auswahllisten | ja | ja | – | – | ja? | ja |
| `global_list_attributes` | Zusatzattribute der Listen | ja | ja | – | – | nein | nein |
| `global_validations` | globale Prüfregeln | ja | ja | ja | – | nein | ja (Eingabeprüfung) |
| `global_calculations` | globale Berechnungen | ja | ja | ja | – | ja? | ja |
| `form_definition_versions` | **nur in `types.ts`**, kein Code, keine Migration im Repo | ja | – | ja | – | – | – |

## 3. Vorlagen, Etiketten, Symbole

| Tabelle | Oberfläche | ca | ua | cb | ub | Erg. | Abl. |
|---|---|---|---|---|---|---|---|
| `measurement_templates` | Messvorlagen (TemplatesPage) | ja | ja | ja | – | nein | ja (Auftragsanlage) |
| `measurement_template_items` | Positionen der Messvorlagen | – | – | – | – | nein | ja |
| `label_templates` | Etikettenvorlagen (AdminLabelTemplatesPage, LabelDesigner) | ja | ja | ja | – | nein | nein |
| `custom_symbols` | eigene Symbole (AdminSymbolsPage) | ja | ja | ja | ja | nein | nein |

## 4. Rohstoffe, Verbrauchsmaterial, Rezepturen

| Tabelle | Oberfläche | ca | ua | cb | ub | Erg. | Abl. |
|---|---|---|---|---|---|---|---|
| `raw_materials` | Rohstoffe (RawMaterialsPage, Detail) | ja | ja | ja | – | nein | ja? (Rezepte, Chargen) |
| `raw_material_analyses` | Rohstoffanalysen (Detailseite) | ja | – | – | – | ja? (Analysewerte) | nein |
| `storage_locations` | Lagerorte | ja | ja | – | – | nein | nein |
| `consumables` | Verbrauchsmaterial (ConsumablesPage) | ja | ja | – | – | nein | nein |
| `mixtures` | Mischungen/Rezepte (MixturesPage) | ja | ja | ja | – | nein | ja (Chargen) |
| `mixture_recipe_items` | Rezeptpositionen | ja | ja | – | – | nein | ja |
| `mixture_recipe_versions` | Rezeptversionen (**echte Versionierung**) | ja | ja | ja | – | nein | ja |
| `mixture_process_sections` / `mixture_process_steps` / `mixture_planned_measurements` | Prozessplan der Mischung (MixtureDetailPage) | ja | ja | – | – | nein | ja |

## 5. Einstellungen und Stammdaten

| Tabelle | Oberfläche | ca | ua | cb | ub | Erg. | Abl. |
|---|---|---|---|---|---|---|---|
| `company_settings` | Firmendaten (AdminCompanySettingsPage) | – | ja | – | ja | nein | nein (Berichte/Etiketten) |
| `sync_settings` | Synchronisierung (AdminSyncPage) | – | ja | – | ja | nein | ja (Datenabgleich) |
| `hazard_notification_recipients` | Empfänger Gefahrstoffmeldung (AdminHazardNotificationsPage) | ja | – | ja | – | nein | ja (Benachrichtigung) |
| `work_package_categories` | Arbeitspaket-Kategorien (AdminWorkPackageCategoriesPage) | ja | ja | – | – | nein | nein |
| `project_expense_categories` | Kostenarten in Projekten (nur gelesen, in diesem Code keine Änderung gefunden) | ja | ja | – | – | nein | nein |
| `production_release_settings` | Einstellungen Produktionsfreigabe | ja | ja | – | ja | nein | ja |
| `test_equipment` | Prüfmittel (EquipmentPage) | ja | ja | ja | – | nein | nein |
| `workstations` / `workstation_tasks` | Arbeitsplätze (Kalender, Planung) | ja | ja | – | – | nein | ja (Planung) |

## Hinweise und Grenzen

- **Nicht vollständig geprüft:** Die Auswirkungen „ja?" sind Einschätzungen aus Namen und Code. Tabellen, die nur über Datenbankfunktionen (`rpc`) geschrieben werden, habe ich nicht einzeln aufgeführt, z. B. `clone_global_form`, `rename_form_definition`, `snapshot_template`, `clone_template_as_new_version`, `create_mixture_recipe_version`, `activate_mixture_recipe_version`.
- **Spalten stammen aus `types.ts`**, also vom Stand, aus dem Lovable die Typen erzeugt. Die Dev-DB kann abweichen. Die tatsächlichen Spalten in Prod lassen sich mit einer Abfrage auf `information_schema.columns` prüfen.
- **Ohne Änderer-Spalte** sind unter anderem `form_fields`, `form_definitions`, `form_calculations`, `service_data_fields`, `service_forms`, `global_fields` und alle Workflow-Tabellen. Ein Änderungsprotokoll mit Benutzer wäre dort nur über eine neue Migration (Trigger) möglich, siehe Bericht zu Aufgabe 029.
