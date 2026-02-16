

## Messungen in der Auftragsdetailseite mit Arbeitsplaetzen verlinken

### Ziel
In der Auftragsdetailseite (`OrderDetailPage`) wird der Arbeitsplatzname bereits angezeigt (Spalte "Arbeitsplatz"), ist aber nur statischer Text. Dieser soll klickbar werden und zur Arbeitsplatz-Verwaltungsseite navigieren.

### Aenderung

**Datei: `src/pages/OrderDetailPage.tsx`**

Die Arbeitsplatz-Zelle (Zeile 158) wird so angepasst, dass der Arbeitsplatzname als klickbarer Link zur Seite `/admin/arbeitsplaetze` fuehrt:

- Der Arbeitsplatzname wird in ein klickbares Element mit `cursor-pointer`, `text-primary` und `hover:underline` Styling gewandelt
- Bei Klick wird `navigate("/admin/arbeitsplaetze")` aufgerufen
- Falls kein Arbeitsplatz zugewiesen ist, bleibt der Strich ("–") unveraendert

### Betroffene Dateien
- `src/pages/OrderDetailPage.tsx` -- eine kleine Aenderung in der Arbeitsplatz-Tabellenzelle

### Was sich aendert
- **Vorher:** Arbeitsplatzname als statischer Text
- **Nachher:** Arbeitsplatzname als klickbarer Link zur Arbeitsplatz-Verwaltung
