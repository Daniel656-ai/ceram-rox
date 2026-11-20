import "@testing-library/jest-dom";
import { configure } from "@testing-library/react";

// Großzügigere Wartezeit für asynchrone Abfragen (findBy…/waitFor): schwere Seiten rendern im Volllauf mit vielen
// parallelen Tests langsamer als die Standardwerte (1 s). Nur Testlauf, keine Auswirkung auf die Anwendung.
configure({ asyncUtilTimeout: 10000 });

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
