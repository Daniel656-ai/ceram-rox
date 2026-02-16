

## Messauftraege bearbeiten und loeschen

### Uebersicht
Bearbeitungs- und Loeschfunktionen fuer Messauftraege mit rollenabhaengiger Berechtigung:
- **Master**: Kann alle Messauftraege bearbeiten und loeschen, unabhaengig vom Status
- **Auftraggeber**: Kann nur eigene Messauftraege mit Status "Offen" bearbeiten oder loeschen

### Aenderungen

**1. Datenbank-Migration: DELETE-Policy fuer `measurement_orders`**

Aktuell fehlt eine DELETE-Policy. Neue Policy:

```sql
CREATE POLICY "Users delete relevant orders"
ON public.measurement_orders
FOR DELETE
USING (
  has_role(auth.uid(), 'master'::app_role)
  OR (created_by = auth.uid() AND status = 'open'::order_status)
);
```

Die bestehende UPDATE-Policy erlaubt bereits Updates fuer Creator und Master. Die Status-Einschraenkung fuer Auftraggeber wird im Frontend durchgesetzt (Backend erlaubt Update fuer Creator generell, was fuer Statusuebergaenge noetig ist).

**2. Neuer Hook: `useDeleteOrder` in `src/hooks/useOrders.ts`**

Mutation die `supabase.from("measurement_orders").delete().eq("id", id)` ausfuehrt und die Query-Caches invalidiert.

**3. Neuer Hook: `useUpdateOrder` in `src/hooks/useOrders.ts`**

Mutation die `notes`, `due_date` und `order_type` eines Auftrags aktualisiert.

**4. UI in `src/pages/OrdersPage.tsx` -- Loeschen-Button pro Zeile**

- Neue Spalte "Aktionen" in der Tabelle
- Loeschen-Button (Papierkorb-Icon) mit Bestaetigung ueber AlertDialog
- Sichtbarkeitslogik:
  - Master: immer sichtbar
  - Auftraggeber: nur wenn `o.status === "open"` und `o.created_by === user.id`
  - Durchfuehrer: kein Loeschen-Button

**5. UI in `src/pages/OrderDetailPage.tsx` -- Bearbeiten und Loeschen im Header**

- "Bearbeiten"-Button oeffnet Dialog mit Formular fuer Auftragstyp, Faelligkeitsdatum und Anmerkungen
- "Loeschen"-Button mit AlertDialog-Bestaetigung, navigiert nach Loeschung zurueck zur Uebersicht
- Sichtbarkeitslogik wie bei der Uebersicht:
  - Master: beide Buttons immer sichtbar
  - Auftraggeber: nur bei Status "Offen" und eigenem Auftrag
  - Durchfuehrer: keine Buttons

### Betroffene Dateien
- Datenbank-Migration (neue DELETE-Policy)
- `src/hooks/useOrders.ts` -- neue Hooks `useDeleteOrder` und `useUpdateOrder`
- `src/pages/OrdersPage.tsx` -- Aktionen-Spalte mit Loeschen
- `src/pages/OrderDetailPage.tsx` -- Bearbeiten-Dialog und Loeschen im Header

