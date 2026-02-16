

## Messungen automatisch dem Standard-Arbeitsplatz zuweisen

### Problem
Beim Hinzufuegen einer Messung zu einem neuen Messauftrag wird der Arbeitsplatz immer leer gelassen, obwohl in den Messdienstleistungs-Stammdaten (`measurement_services`) bereits ein Standard-Arbeitsplatz (`workstation_id`) hinterlegt sein kann.

### Loesung
Beim Hinzufuegen einer Messdienstleistung im Auftragsformular wird der in den Stammdaten hinterlegte Standard-Arbeitsplatz automatisch vorbelegt. Der Benutzer kann ihn anschliessend noch manuell aendern.

### Aenderung

**Datei: `src/pages/CreateOrderPage.tsx`**

In der Funktion `addService` (Zeile 47-51) wird beim Erstellen eines neuen Messungs-Eintrags das Feld `workstation_id` mit dem Wert aus `svc.workstation_id` vorbelegt statt mit einem leeren String:

```typescript
// Vorher:
workstation_id: ""

// Nachher:
workstation_id: svc.workstation_id || ""
```

Das ist die einzige Aenderung. Die `useServices`-Query laedt bereits alle Felder (`select("*")`), sodass `workstation_id` verfuegbar ist.

### Betroffene Dateien
- `src/pages/CreateOrderPage.tsx` -- eine Zeile in der `addService`-Funktion

