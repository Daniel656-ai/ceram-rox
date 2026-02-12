

## Administrations-Dashboard fuer Arbeitsplaetze

### Uebersicht

Es wird ein neues Verwaltungsmodul fuer Arbeitsplaetze erstellt. Dieses umfasst zwei neue Datenbanktabellen, eine neue Seite mit Tabellen- und Aufgabenverwaltung, sowie die Integration in die bestehende Navigation.

### Was wird gebaut

**1. Neue Datenbanktabellen**

- **workstations** - Arbeitsplaetze mit Name, Beschreibung, Status (active/inactive), verantwortlichem Benutzer
- **workstation_tasks** - Aufgaben pro Arbeitsplatz mit Titel, Beschreibung, zugewiesener Person, Faelligkeitsdatum, Stundensatz, Status

**2. Neue Seite: Arbeitsplaetze verwalten**

Die Seite zeigt:
- Uebersicht aller Arbeitsplaetze in einer Tabelle (Name, Status, Verantwortlicher)
- Button zum Erstellen neuer Arbeitsplaetze
- Aufklappbare/Detail-Ansicht pro Arbeitsplatz mit zugeordneten Aufgaben
- Dialog zum Erstellen/Bearbeiten von Aufgaben (Titel, Beschreibung, Person, Faelligkeitsdatum, Stundensatz)
- Filter fuer Aufgaben nach Status
- Anzeige der Benutzerrolle neben dem Namen

**3. Navigation**

- Neuer Eintrag "Arbeitsplaetze" im Admin-Bereich der Sidebar (nur fuer master-Rolle sichtbar)
- Neue Route: `/admin/arbeitsplaetze`

### Technische Details

**Datenbank-Migration (SQL):**

```sql
-- Arbeitsplaetze
CREATE TABLE public.workstations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  responsible_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workstations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read workstations"
  ON public.workstations FOR SELECT USING (true);

CREATE POLICY "Masters can manage workstations"
  ON public.workstations FOR ALL
  USING (has_role(auth.uid(), 'master'))
  WITH CHECK (has_role(auth.uid(), 'master'));

-- Aufgaben pro Arbeitsplatz
CREATE TYPE public.task_status AS ENUM ('open', 'in_progress', 'completed');

CREATE TABLE public.workstation_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_id uuid NOT NULL REFERENCES public.workstations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to uuid,
  due_date date,
  hourly_rate numeric NOT NULL DEFAULT 0,
  status task_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workstation_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read tasks"
  ON public.workstation_tasks FOR SELECT USING (true);

CREATE POLICY "Masters can manage tasks"
  ON public.workstation_tasks FOR ALL
  USING (has_role(auth.uid(), 'master'))
  WITH CHECK (has_role(auth.uid(), 'master'));

-- updated_at Trigger
CREATE TRIGGER update_workstations_updated_at
  BEFORE UPDATE ON public.workstations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workstation_tasks_updated_at
  BEFORE UPDATE ON public.workstation_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Neue Dateien:**

- `src/hooks/useWorkstations.ts` - React-Query Hooks fuer CRUD auf workstations und workstation_tasks
- `src/pages/AdminWorkstationsPage.tsx` - Hauptseite mit Arbeitsplatz-Tabelle, Aufgabenverwaltung, Filter, Dialoge

**Aenderungen an bestehenden Dateien:**

- `src/components/AppSidebar.tsx` - Neuer Menueeintrag "Arbeitsplaetze" in masterAdminItems
- `src/App.tsx` - Neue Route `/admin/arbeitsplaetze`

**Berechtigungen:**

- Nur Benutzer mit der Rolle "master" koennen Arbeitsplaetze und Aufgaben erstellen, bearbeiten und loeschen
- Aufgaben koennen Benutzern mit der Rolle "durchfuehrer" oder "master" zugewiesen werden
- Die Seite ist nur ueber die Admin-Navigation erreichbar (master-only)

