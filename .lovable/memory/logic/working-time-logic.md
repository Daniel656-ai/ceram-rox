---
name: Working time logic
description: Austrian working time (38.5h/week default) with per-user part-time schedules and pro-rata vacation
type: feature
---
# Working time & vacation logic

## Defaults (no per-user schedule defined)
- Mo–Thu: 7,75h/Tag, Fr: 7,5h/Tag → 38,5h/Woche
- Wochenende: 0h, AT-Feiertage: 0h
- Vollzeit-Urlaubsanspruch: 25 Arbeitstage/Jahr (5 Wochen × 5 Tage)

## Individuelle Schedules (Tabelle `user_work_schedules`)
- Pro Mitarbeiter:in beliebig viele Schedules mit `valid_from`-Datum (Historie)
- Felder: `weekly_hours`, `works_monday … works_sunday` (boolean)
- `get_user_work_schedule(user_id, on_date)` liefert das gültige Schedule
- Verwaltung im Admin → Benutzer → Arbeitszeit-Dialog (Master)

## Urlaubsberechnung (tagesbasiert)
- Anspruch = Arbeitstage/Woche × 5 (z. B. 3 Tage → 15 Tage Urlaub)
- 1 Arbeitstag = 1 Urlaubstag
- Verbrauch wird nur für **scheduled Wochentage** UND **kein AT-Feiertag/Wochenende** gezählt
- Implementation: `countVacationDaysUsed` in `src/hooks/useWorkSchedules.ts`

## Sichtbarkeit (Privacy)
- Permission `calendar.view_others_vacation` (Default: nur Master)
- Ohne Permission: Mitarbeiter sehen ausschließlich eigenen Urlaubsstand
- Helper-Funktion `can_view_others_vacation` in DB

## UI-Stellen
- Admin → Benutzer: `UserWorkScheduleDialog` (Wochentag-Checkboxen + Wochenstunden + valid_from + Historie)
- Kalender: Urlaubsübersicht-Card, dynamisch basierend auf `useEffectiveSchedules`
- Auslastung (`useUtilization.ts`): nutzt weiterhin `countWorkingHours` als Soll-Kapazität (Standard-Mo-Fr) — kann pro Mitarbeiter:in später auf Schedule umgestellt werden, falls gewünscht
