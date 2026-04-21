

## Ziel

Ein Benutzer mit Rolle `auftraggeber` darf in der Auftragsliste nur noch sehen:
- Aufträge, die er selbst erstellt hat (`created_by = auth.uid()`), **plus**
- Aufträge in Projekten, in denen er die Projekt-Rolle `owner` oder `leader` hat.

Eine reine Projekt-Mitgliedschaft (`member`) reicht für Auftraggeber nicht mehr aus, um fremde Aufträge zu sehen. Master und Durchführer behalten ihre bisherige Sichtbarkeit unverändert.

## Umsetzung

### 1. RLS-Policy `Users see relevant orders` neu schreiben (Migration)

Die bestehende `SELECT`-Policy auf `measurement_orders` wird ersetzt. Neue Logik:

```text
master                                              -> sieht alles
created_by = auth.uid()                             -> eigener Auftrag
durchfuehrer und assigned_to_order                  -> zugewiesener Auftrag
NICHT auftraggeber UND project_member               -> Mitgliedschaft (alte Logik
                                                       für Durchführer/sonstige Rollen)
auftraggeber UND (owner ODER leader des Projekts)   -> nur Leitungsrolle reicht
```

In SQL:

```sql
DROP POLICY "Users see relevant orders" ON public.measurement_orders;

CREATE POLICY "Users see relevant orders"
ON public.measurement_orders
FOR SELECT
USING (
  has_role(auth.uid(), 'master'::app_role)
  OR created_by = auth.uid()
  OR is_assigned_to_order(auth.uid(), id)
  OR (
    NOT has_role(auth.uid(), 'auftraggeber'::app_role)
    AND is_project_member(auth.uid(), project_id)
  )
  OR (
    has_role(auth.uid(), 'auftraggeber'::app_role)
    AND (
      has_project_role(auth.uid(), project_id, 'owner'::project_role)
      OR has_project_role(auth.uid(), project_id, 'leader'::project_role)
    )
  )
);
```

Genutzte SECURITY-DEFINER-Helfer existieren bereits: `has_role`, `is_assigned_to_order`, `is_project_member`, `has_project_role`. Damit bleibt RLS rekursionsfrei.

### 2. Konsistente Einschränkung auf abhängigen Tabellen

Damit ein Auftraggeber nicht über Umwege (verknüpfte Sub-Selects) doch Inhalte fremder Aufträge sieht, müssen die analogen `project_member`-Zweige in folgenden bestehenden Policies ebenfalls für Auftraggeber neutralisiert werden:

- `order_measurements` – Policy „Users see relevant measurements“
- `measurement_parameters` – Policy „Users see relevant params“
- `measurement_results` – Policy „Users see relevant results“
- `documents` – Policy „Users see relevant docs“
- `order_audit_log` – Policy „Users see relevant audit logs“

Pattern überall identisch: der Teil
```sql
EXISTS (... WHERE ... AND is_project_member(auth.uid(), mo.project_id))
```
wird zu
```sql
EXISTS (
  ... WHERE ... AND (
    (NOT has_role(auth.uid(), 'auftraggeber'::app_role)
       AND is_project_member(auth.uid(), mo.project_id))
    OR (has_role(auth.uid(), 'auftraggeber'::app_role)
       AND (has_project_role(auth.uid(), mo.project_id, 'owner'::project_role)
            OR has_project_role(auth.uid(), mo.project_id, 'leader'::project_role)))
  )
)
```

Der direkte `created_by`/`assigned_to`/`master`-Pfad bleibt jeweils unverändert – Auftraggeber sehen ihre eigenen Inhalte weiterhin uneingeschränkt.

### 3. Keine Frontend-Änderungen nötig

`useOrders` und `useOrderDetail` führen keine eigene Filterung durch – sie verlassen sich vollständig auf RLS. Sobald die Policies aktualisiert sind, verschwinden die fremden Aufträge automatisch aus Liste, Suche (Dashboard) und Detailaufrufen. Direkter URL-Zugriff (`/auftraege/<fremde-id>`) liefert dann ebenfalls kein Ergebnis und führt zur Not-Found-Behandlung der Detail-Seite.

### 4. Verifikation nach dem Deployment

- Test als Auftraggeber A:
  - Eigener Auftrag in Projekt P1 (Rolle: owner) → sichtbar.
  - Fremder Auftrag in Projekt P1 (Auftraggeber B, A ist owner/leader) → sichtbar.
  - Fremder Auftrag in Projekt P2, in dem A nur `member` ist → **nicht** sichtbar.
  - Fremder Auftrag in Projekt P3, in dem A keine Mitgliedschaft hat → **nicht** sichtbar.
- Test als Master: alle Aufträge sichtbar (unverändert).
- Test als Durchführer: zugewiesene Aufträge + Projektmitgliedschaft wirken weiter wie bisher.

## Technische Notizen

- Reine Policy-Änderung, keine Schemaänderungen, keine Datenmigration.
- Wird als eine SQL-Migration ausgeliefert (DROP + CREATE für jede betroffene Policy).
- Keine neuen Helper-Funktionen erforderlich.
- `is_project_member` bleibt erhalten und wird weiterhin von `projects`, `project_milestones`, `project_work_packages` etc. genutzt – diese Module sollen sich für Auftraggeber-Mitglieder nicht ändern.

