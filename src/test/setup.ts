import "@testing-library/jest-dom";
import { configure } from "@testing-library/react";

// Großzügigere Wartezeit für asynchrone Abfragen (findBy…/waitFor): schwere Seiten rendern im Volllauf mit vielen
// parallelen Tests langsamer als die Standardwerte (1 s). Nur Testlauf, keine Auswirkung auf die Anwendung.
configure({ asyncUtilTimeout: 10000 });

// Node ≥ 25 legt ein eigenes globales `localStorage` an, das ohne `--localstorage-file` `undefined` liefert und das
// funktionierende `localStorage` von jsdom überdeckt. Dann den Speicher von jsdom einsetzen (unter Node ≤ 24 ist
// `localStorage` vorhanden, dort greift das nicht). Nur Testlauf, keine Auswirkung auf die Anwendung.
{
  const jsdomStorage = (globalThis as { jsdom?: { window?: Window } }).jsdom?.window?.localStorage;
  if (typeof globalThis.localStorage === "undefined" && jsdomStorage) {
    Object.defineProperty(globalThis, "localStorage", { value: jsdomStorage, configurable: true, writable: true });
  }
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
