

# LIMS – Laboratory Information Management System (MVP)

## Überblick
Ein professionelles, deutschsprachiges Labor-Informationsmanagementsystem mit rollenbasierter Zugriffskontrolle. Clean & Professional Design mit klaren Linien, viel Weißraum und einer aufgeräumten Sidebar-Navigation. Das MVP konzentriert sich auf die Kernfunktionen: Authentifizierung, Auftraggeber-Dashboard und Admin-Grundfunktionen.

---

## Phase 1: Authentifizierung & Benutzerverwaltung

### Login-Seite
- E-Mail-basierte Anmeldung (Deutsch)
- Passwort-zurücksetzen-Funktion
- Professionelles, minimalistisches Login-Design

### Benutzerprofil-System
- Profiltabelle mit Vor- und Nachname
- Rollensystem mit drei Rollen: **Master**, **Auftraggeber**, **Durchführer**
- Rollen werden in separater Tabelle gespeichert (Sicherheit)

### Rollenbasierte Navigation
- Nach Login wird der User automatisch zu seinem rollenspezifischen Dashboard weitergeleitet
- Menüpunkte und Seitenzugriff basierend auf der Rolle eingeschränkt

---

## Phase 2: Auftraggeber-Interface

### Auftrags-Dashboard
- Übersicht aller eigenen Aufträge in einer Tabelle
- Statusspalten: Neu, In Bearbeitung, Abgeschlossen, Storniert
- Prioritätsanzeige (Hoch, Mittel, Niedrig) mit farblicher Kennzeichnung
- Such- und Filterfunktionen (nach Status, Priorität, Datum)

### Auftragserstellung & -bearbeitung
- Formular zum Erstellen von Mess- und Prüfaufträgen
- Felder: Auftragstyp, Beschreibung, Priorität, Fälligkeitsdatum
- Aufträge bearbeiten, Priorität ändern und stornieren
- Kommentarfunktion pro Auftrag (Verlauf sichtbar)

### Dokument-Upload
- Mehrere Dokumente pro Auftrag hochladen
- Dokumente einsehen, herunterladen und verwalten
- Supabase Storage für sichere Dateiablage

### Template-System
- Auswahl aus Standard-Auftrags-Templates
- Eigene Templates erstellen, speichern und bearbeiten
- Templates beim Erstellen neuer Aufträge auswählen

---

## Phase 3: Admin-Dashboard (Grundfunktionen)

### Benutzerverwaltung
- Benutzer anlegen, bearbeiten und deaktivieren
- Rollen zuweisen und ändern
- Übersicht aller Benutzer mit Rolle und Status

### System-Übersicht
- Statistiken: Anzahl Aufträge, Benutzer, offene Aufträge
- Alle Aufträge einsehen (systemweit)
- Audit-Log: Wer hat wann was geändert

---

## Phase 4 (Ausblick – nach MVP): Durchführer-Interface
- Zugewiesene Aufträge sehen und bearbeiten
- Messergebnisse und Prüfergebnisse eintragen
- Probenmanagement
- Prüfprotokolle erstellen
- QA/QC-Workflows

---

## Technische Umsetzung
- **Backend**: Lovable Cloud (Supabase) für Datenbank, Auth, Storage und Edge Functions
- **Design**: Clean & Professional – helle Farben, klare Typografie, Sidebar-Navigation
- **Sprache**: Komplett deutschsprachige Benutzeroberfläche
- **Sicherheit**: Row-Level Security, rollenbasierte Zugriffskontrolle, separates Rollen-Management

