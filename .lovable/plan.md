

## Ziel

Ein **Projektleiter** (Mitglied mit Projekt-Rolle `leader`, ebenso `owner`) soll Messungen innerhalb von Aufträgen seines Projekts an Durchführer zuweisen können – aktuell ist das nur für `master` möglich.

## Umsetzung

### 1. RLS-Policy `Relevant users update measurements` erweitern (Migration)

Aktuell:
```sql
USING (
  has_role(auth.uid(), 'master')
  OR assigned_to = auth.uid()
  OR is_order_creator(auth.uid(), order_id)
)
```

Neu — zusätzlich Projekt-Owner/Leader des Projekts, zu dem der Auftrag gehört:
```sql
DROP POLICY "Relevant users update measurements" ON public.order_measurements;

CREATE POLICY "Relevant users update measurements"
ON public.order_measurements
FOR UPDATE
USING (
  has_role(auth.uid(), 'master'::app_role)
  OR assigned_to = auth.uid()
  OR is_order_creator(auth.uid(), order_id)
  OR EXISTS (
    SELECT 1 FROM measurement_orders mo
    WHERE mo.id = order_measurements.order_id
      AND (
        has_project_role(auth.uid(), mo.project_id, 'owner'::project_role)
        OR has_project_role(auth.uid(), mo.project_id, 'leader'::project_role)
      )
  )
);
```

Damit darf ein Projektleiter Felder wie `assigned_to`, `ranking`, `status` etc. seiner Projekt-Messungen aktualisieren.

### 2. Frontend: Zuweisung in `OrderDetailPage` für Leiter/Owner freischalten

In `src/pages/OrderDetailPage.tsx`:

- Projekt-Mitglieder des Auftragsprojekts laden (via `useProjectMembers((order as any).project_id)`).
- Neue Berechtigungs-Flags ableiten:
  ```ts
  const myMembership = projectMembers.find(m => m.user_id === user?.id);
  const isProjectLead = myMembership?.role === "owner" || myMembership?.role === "leader";
  const canAssign = role === "master" || isProjectLead;
  ```
- Die beiden Stellen, die heute `role === "master"` für die Bearbeitung in der Messungs-Tabelle prüfen, auf `canAssign` umstellen:
  - Spalte „Priorität/Ranking" (Zeile ~281)
  - Spalte „Zugewiesen an" (Zeile ~307)

Anzeigelogik bleibt sonst unverändert; wenn `canAssign` falsch ist, wird wie bisher der reine Text/Badge gerendert.

### 3. Keine weiteren Änderungen nötig

- `useAssignMeasurement` und `useUpdateMeasurementRanking` rufen bereits ein einfaches `update` auf `order_measurements` – die neue Policy deckt das ab.
- `useDurchfuehrer` ist bereits öffentlich lesbar (Profile + user_roles SELECT), funktioniert für Projektleiter ebenso.
- Sichtbarkeit der Aufträge bleibt durch die zuvor aktualisierten SELECT-Policies geregelt: Auftraggeber ohne Projekt-Leitungsrolle sehen den Auftrag nicht, kommen also gar nicht erst auf die Detailseite.

## Verifikation

- **Master**: kann wie bisher zuweisen.
- **Projektleiter (Owner/Leader)**: sieht im Detail eines Auftrags seines Projekts die Auswahlboxen für Ranking und „Zugewiesen an" und kann diese ändern.
- **Reines Projektmitglied (`member`)**: sieht weiterhin nur Anzeige, keine Auswahl.
- **Auftragsersteller**: kann seinen eigenen Auftrag wie bisher öffnen, ohne neue Rechte für Zuweisung (außer er ist selbst Owner/Leader).
- **Durchführer ohne Leitungsrolle**: unverändert – nur Statuswechsel an eigenen zugewiesenen Messungen.

## Technische Notizen

- Eine SQL-Migration (DROP + CREATE der UPDATE-Policy auf `order_measurements`).
- Frontend-Änderung in genau einer Datei (`OrderDetailPage.tsx`): Hook-Import + zwei Bedingungen.
- Keine neuen Hilfsfunktionen, kein Schema-Change.

