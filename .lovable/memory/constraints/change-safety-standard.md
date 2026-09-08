---
name: ROX Change Safety Standard
description: Verbindlicher Bestandsschutz für Infrastruktur, Daten und bestehende Funktionen bei jeder Änderung an ROX
type: constraint
---

# ROX Change Safety Standard (verbindlich ab 2026-09-08)

## 1. Bestandsschutz Infrastruktur
Niemals eigenmächtig ändern: Backend-URL, Supabase-Projekt/Project-ID, Datenbanken,
Storage-Buckets, Edge Functions, Secrets, Environment Variables, Auth-/Berechtigungsstrukturen.
Änderung nur bei ausdrücklicher, bestätigter Anweisung des Auftraggebers.
**Why:** Produktive Unternehmensanwendung mit sensiblen Firmen-/Auftrags-/Mess-/Kunden-/Produktionsdaten.

## 2. Bestehende Funktionen haben Vorrang
"Erweitere das bestehende System. Ersetze nicht das bestehende System."
Neue Features möglichst isoliert und additiv ergänzen. Bestehende Aufträge, Projekte,
Dienstleistungen, Formulare, Messfälle, Messdatenblöcke, Ergebnisfelder/-daten, Proben,
Rohstoffe, Fertigungsfreigaben, Importe, Exporte, Berechnungen, Rollen/Berechtigungen und
Workflow-Verknüpfungen dürfen nie beschädigt werden.

## 3. Analyse vor Änderung (STOP-Regel)
Vor jeder Änderung: bestehende Implementierung analysieren, Abhängigkeiten ermitteln,
additive Lösung bevorzugen. Wenn eine bestehende Struktur geändert werden müsste:
STOP – betroffene Struktur, abhängige Funktionen, Notwendigkeit, Risiko und sichere
Alternative erklären. Keine destruktive Änderung ohne ausdrückliche Freigabe.

## 4. Fehler an der Ursache beheben
Fehler in Web/Desktop nie durch Ändern der Backend-Adresse/Infrastruktur "beheben".
Zuerst vergleichen: Backend-Konfiguration, Supabase-Instanz, Env-Variablen,
Storage-Berechtigungen, Auth/Session, Edge Function, CORS/Netzwerk, konkrete Anfrage.

## 5. Verboten: Reparatur durch Austausch
Kein neues Backend, keine Backend-Adressänderung, keine Datenbank-/Tabellen-Neuerstellung
zur Fehlerumgehung, kein Ersetzen von Storage-Buckets/Edge Functions ohne Abhängigkeitsprüfung,
kein Überschreiben bestehender Env-Variablen, keine Auth-Änderung für Einzelfehler.

## 6. Datenbankänderungen rückwärtskompatibel
Neue Tabellen oder neue optionale Spalten bevorzugen. Keine Spalten löschen/umbenennen,
keine Daten verändern, keine Beziehungen entfernen, keine IDs ändern, keine Datenmigration
ohne ausdrückliche Freigabe. Neue Strukturen müssen mit bestehenden Daten funktionieren.

## 7. Bestehende Daten schützen
Vor Änderungen prüfen: bestehende Datensätze lesbar/bearbeitbar? Aufträge, Messungen,
Importe, Ergebnisberichte, Berechnungen funktionieren weiterhin? Kein stiller Datenverlust.

## 8. Testpflicht
Nach größeren Änderungen prüfen: Login/Auth, Auftragserstellung, Projektverwaltung,
Dienstleistungsverwaltung, Probenverwaltung, Formulare, Messfälle, Messdaten,
Ergebnisdatenbank, Importe, Exporte, Berichte, Rollen/Berechtigungen + neue Funktion
+ Integration mit Bestehendem.

## 9. Webapp UND Desktop-Version prüfen
Änderungen nie nur für die Webapp optimieren. Gemeinsame Backend-Verbindung, Daten,
Edge Functions und Storage-Funktionen sicherstellen. Technische Abweichungen
Web vs. Desktop ausdrücklich dokumentieren.

## 10. Keine stillen Architekturänderungen
Wenn eine Architekturänderung nötig scheint: "STOP – bestehende Infrastruktur betroffen.",
Änderung/Notwendigkeit/Betroffene/Alternative/Testweg erklären, erst nach Freigabe umsetzen.

## 11. Grundprinzip
Neue Funktionen hinzufügen – bestehende schützen. Fehler beheben – nicht Infrastruktur
austauschen. Erweitern – nicht ersetzen. Testen – dann veröffentlichen. Bei Unsicherheit:
nichts Bestehendes verändern, erst analysieren und nachfragen.
