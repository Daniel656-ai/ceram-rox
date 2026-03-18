

## Prioritaet als Pflichtfeld fuer Messauftraege

### Uebersicht
Ein neues Pflichtfeld "Prioritaet" wird auf Auftragsebene (`measurement_orders`) eingefuehrt -- nicht zu verwechseln mit der bestehenden Messungs-Prioritaet auf `order_measurements`. Aenderungen werden in einer neuen Audit-Log-Tabelle protokolliert.

### 1. Datenbank-Migration

**Neuer Enum-Typ:**
```sql
CREATE TYPE public.order_priority AS ENUM ('normal', 'wichtig', 'hoechste');
```

**Neue Spalte auf `measurement_orders`:**
```sql
ALTER TABLE public.measurement_orders
  ADD COLUMN priority order_priority NOT NULL DEFAULT 'normal';
```

**Neue Tabelle `order_audit_log`:**

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | uuid (PK) | Eindeutige ID |
| order_id | uuid (FK) | Verweis auf measurement_orders |
| changed_by | uuid | User-ID des Aendernden |
| changed_at | timestamptz | Zeitpunkt der Aenderung |
| field_name | text | Geaendertes Feld (z.B. 'priority') |
| old_value | text | Alter Wert |
| new_value | text | Neuer Wert |

RLS-Policies fuer `order_audit_log`:
- SELECT: Master sehen alles; Auftraggeber sehen Logs eigener Auftraege; Durchfuehrer sehen Logs zugewiesener Auftraege
- INSERT: Nur ueber Trigger (kein direkter Client-Insert noetig, aber Policy fuer authentifizierte User mit `changed_by = auth.uid()`)

**Datenbank-Trigger `log_order_priority_change`:**
Ein `BEFORE UPDATE`-Trigger auf `measurement_orders`, der bei Aenderung von `priority` automatisch einen Eintrag in `order_audit_log` schreibt.

### 2. Typ-Definitionen (`src/lib/types.ts`)

Neuer Export:
```typescript
export type OrderPriority = Database["public"]["Enums"]["order_priority"];

export const ORDER_PRIORITY_LABELS: Record<OrderPriority, string> = {
  normal: "Normal",
  wichtig: "Wichtig",
  hoechste: "Höchste",
};
```

### 3. Hooks (`src/hooks/useOrders.ts`)

- `useUpdateOrder`: Feld `priority` als optionalen Parameter aufnehmen
- Neuer Hook `useOrderAuditLog(orderId)`: Laedt die Audit-Log-Eintraege fuer einen Auftrag

### 4. Auftragserstellung (`src/pages/CreateOrderPage.tsx`)

- Neuer State `priority` mit Standardwert `"normal"`
- Neues Auswahlfeld (Select-Dropdown) im Abschnitt "Auftragsdetails" mit den drei Optionen: Hoechste, Wichtig, Normal
- Der Wert wird beim `createOrder.mutateAsync`-Aufruf mitgegeben

### 5. Auftragsdetailseite (`src/pages/OrderDetailPage.tsx`)

- Prioritaet im Header anzeigen (als Badge neben dem Status)
- Im Bearbeiten-Dialog: Prioritaets-Dropdown hinzufuegen
- Berechtigungslogik: Prioritaetsaenderung nur fuer Master oder Ersteller (unabhaengig vom Status, da die Anforderung sich nur auf die Prioritaet bezieht -- die bestehende canEditDelete-Logik bleibt fuer andere Felder bestehen)
- Neuer Abschnitt "Aenderungsverlauf" am Ende der Seite mit Tabelle der Audit-Log-Eintraege (Datum, Benutzer, altes/neues Feld)

### 6. Auftragsuebersicht (`src/pages/OrdersPage.tsx`)

- Neue Spalte "Prioritaet" in der Tabelle mit farbigem Badge

### Betroffene Dateien
- Datenbank-Migration (Enum, Spalte, Audit-Tabelle, Trigger, RLS)
- `src/lib/types.ts` -- neuer Typ und Labels
- `src/hooks/useOrders.ts` -- Update-Hook erweitern, neuer Audit-Log-Hook
- `src/pages/CreateOrderPage.tsx` -- Prioritaets-Dropdown
- `src/pages/OrderDetailPage.tsx` -- Anzeige, Bearbeitung, Aenderungsverlauf
- `src/pages/OrdersPage.tsx` -- Prioritaets-Spalte
