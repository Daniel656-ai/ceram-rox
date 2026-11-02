# Roadmap

## Offen
1. **Versuchsnummern historische Pilot-Plant-Aufträge** (freigegeben, Frontend/Logik):
   - Phase 1: Bestandsanalyse (orderIdentity, experimentNumber, PilotPlantProcessPanel, CreateOrderPage, api/orders, backendConfig)
   - Phase 2: Zentrale Auflösung mit Priorität pp_experiment_number > pp.stammdaten.versuchsnummer > template.values.versuchsnummer + Konflikterkennung
   - Phase 3: 15 historische Aufträge einzeln prüfen (Cloud-Datenbestand; Firmen-Backend ggf. nicht erreichbar → ausweisen)
   - Phase 4: Tests (10 Kernfälle) + Regressionen, Typecheck, Build
   - Phase 5: Web-Abnahme; Desktop-Abnahme getrennt ausweisen
   - Abschlussbericht nach /mnt/documents
2. **m³-Liste PDF-Layout Ursachenanalyse** (NUR Analyse, keine Implementierung):
   - Prüfen ob buildM3PdfModel zweispaltig rendert oder nur Textreihenfolge; Regressionstest bewerten; Bericht liefern

## Schutzregeln
Keine DB-/Backend-/Auth-/RLS-/Storage-/Secrets-/Env-/Tauri-Änderungen. Keine produktiven Datenänderungen.
