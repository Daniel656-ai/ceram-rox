---
name: Stammdatenreferenz für globale Variablen
description: Desktop-only Datenquelle "Stammdaten" für globale Felder; Referenz hat Vorrang vor Standardwert, kein stiller Fallback
type: feature
---
Globale Variablen (global_fields) können auf Stammdaten verweisen:
Kategorie (global_lists) → Eintrag (global_list_items) → Attribut (global_list_attributes).

- Ablage ausschließlich in `metadata.master_data_ref` ({list_key, item_value, attribute_key}); keine neue Tabelle.
- Referenz hat immer Vorrang vor `default_value`; Standardwert ist bei Referenz nicht erforderlich.
- Fehlender Stammdatenwert → klarer Hinweis im Formular, niemals Fallback auf Standardwert oder alten Wert.
- Nur in der Desktop-/Tauri-Variante aktiv (`runtimeKind() === "desktop"`); Web-Verhalten unverändert.
- Code: `src/lib/masterDataRef.ts`, `GlobalModelTab.tsx` (MasterDataRefPicker), `GlobalFieldPicker.tsx` (Übernahme in Formularfelder), `FormLayoutRenderer.tsx` (MasterDataFieldControl).
