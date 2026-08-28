---
name: Auftragsentwürfe & Vorlagen
description: Autosave-Entwürfe der Auftragserstellung, "Als Vorlage verwenden" mit Kopierauswahl, Diff gegen Vorlagenstand
type: feature
---

- Tabelle `order_drafts` (JSON-Payload des Auftraggeberformulars) ist die einzige neue Struktur. Ein Entwurf ist NIE ein produktiver Auftrag: keine Auftragsnummer, keine Aufgaben, kein Workflow, keine Arbeitszeit, keine Ergebnisse. RLS: nur eigene Entwürfe (master darf sehen/löschen).
- Autosave (`useOrderDraftAutosave`, 1,2 s Debounce) in `CreateOrderPage`; Fortsetzen via `/auftraege/neu?draft=<id>`. Nach erfolgreichem Absenden wird der Entwurf gelöscht.
- Vorlagen: `src/lib/orderTemplateCopy.ts` erzeugt reine Deep-Copies (keine Shared References). Niemals kopiert: Auftragsnummer, Status, Workflowstatus, Messnummern, Ergebnisse, Arbeitszeiten, Aufgaben, Abschlussdaten; Proben/Anhänge nur bewusst bzw. gar nicht.
- Herkunft in `source_order_id`/`source_draft_id`/`copied_at`/`copied_by`; `template_baseline` liefert den Diff „unverändert/geändert“ im Prüfbereich vor dem Absenden.
- Steuerung ausschließlich über bestehende Berechtigungen `orders.drafts.manage` und `orders.use_as_template` — ohne diese Rechte ist die Funktion vollständig unsichtbar und deaktiviert.
