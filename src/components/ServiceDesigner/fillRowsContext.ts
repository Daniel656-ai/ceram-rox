import { createContext } from "react";

/**
 * Optional (nur Auftragsformular): ein einzelnes Feld, das allein in seiner Rasterzeile steht
 * (Breite 5–8), wird auf die volle Zeilenbreite gezogen – keine Lücke daneben.
 * Standard aus: Messwerteingabe und andere Formulare bleiben exakt wie definiert.
 */
export const FillRowsCtx = createContext(false);

/**
 * Auftrag bearbeiten: Für den Auftrag liegen bereits Messwerte je Temperaturstufe vor (η-NOx, K-Wert, Gase).
 * Dann dürfen Einträge eines Temperaturblocks nicht mehr verschoben oder gelöscht werden – die Zuordnung der
 * Messwerte zur Temperatur hängt allein an der Reihenfolge. In der Messwerteingabe selbst wird dasselbe aus den
 * Formularwerten abgeleitet (`hasStepMeasurementValues`).
 */
export const TemperatureOrderLockCtx = createContext(false);
