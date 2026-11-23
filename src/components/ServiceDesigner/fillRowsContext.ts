import { createContext } from "react";

/**
 * Optional (nur Auftragsformular): ein einzelnes Feld, das allein in seiner Rasterzeile steht
 * (Breite 5–8), wird auf die volle Zeilenbreite gezogen – keine Lücke daneben.
 * Standard aus: Messwerteingabe und andere Formulare bleiben exakt wie definiert.
 */
export const FillRowsCtx = createContext(false);
