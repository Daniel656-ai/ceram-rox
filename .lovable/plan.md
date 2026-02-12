

## Projektsichtbarkeit fuer alle Benutzer oeffnen

### Ziel
Die aktuelle SELECT-Policy auf der `projects`-Tabelle einschraenkt die Sichtbarkeit auf den Ersteller, Master-Rolle oder zugewiesene Durchfuehrer. Diese soll so geaendert werden, dass **alle authentifizierten Benutzer** alle Projekte sehen koennen.

### Aenderung

**Datenbank-Migration:**
- Die bestehende RLS-Policy "Users see own projects" wird durch eine neue Policy ersetzt, die allen authentifizierten Benutzern Lesezugriff gewaehrt.

```sql
DROP POLICY "Users see own projects" ON public.projects;

CREATE POLICY "All authenticated users can view projects"
  ON public.projects
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
```

### Was sich aendert
- **Vorher:** Nur Ersteller, Master und zugewiesene Durchfuehrer koennen Projekte sehen
- **Nachher:** Jeder eingeloggte Benutzer sieht alle Projekte

### Was unveraendert bleibt
- Erstellen: Nur Auftraggeber und Master
- Bearbeiten: Nur Ersteller und Master
- Loeschen: Nur Ersteller und Master
- Kein Code-Aenderung in der UI noetig

