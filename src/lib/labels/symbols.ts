import ghs01 from "@/assets/ghs/ghs01.svg";
import ghs02 from "@/assets/ghs/ghs02.svg";
import ghs03 from "@/assets/ghs/ghs03.svg";
import ghs04 from "@/assets/ghs/ghs04.svg";
import ghs05 from "@/assets/ghs/ghs05.svg";
import ghs06 from "@/assets/ghs/ghs06.svg";
import ghs07 from "@/assets/ghs/ghs07.svg";
import ghs08 from "@/assets/ghs/ghs08.svg";
import ghs09 from "@/assets/ghs/ghs09.svg";

import psaGoggles from "@/assets/psa/goggles.svg";
import psaGloves from "@/assets/psa/gloves.svg";
import psaMask from "@/assets/psa/mask.svg";
import psaShoe from "@/assets/psa/shoe.svg";
import psaClothing from "@/assets/psa/clothing.svg";
import psaFace from "@/assets/psa/face.svg";
import psaEar from "@/assets/psa/ear.svg";
import psaHelmet from "@/assets/psa/helmet.svg";
import psaExtraction from "@/assets/psa/extraction.svg";
import psaHygiene from "@/assets/psa/hygiene.svg";

export const GHS_SYMBOLS: { key: string; label: string; src: string }[] = [
  { key: "GHS01", label: "Explosiv", src: ghs01 },
  { key: "GHS02", label: "Entzündbar", src: ghs02 },
  { key: "GHS03", label: "Oxidierend", src: ghs03 },
  { key: "GHS04", label: "Gas unter Druck", src: ghs04 },
  { key: "GHS05", label: "Ätzend", src: ghs05 },
  { key: "GHS06", label: "Akut toxisch", src: ghs06 },
  { key: "GHS07", label: "Reizend / Gesundheitsschädlich", src: ghs07 },
  { key: "GHS08", label: "Gesundheitsgefahr", src: ghs08 },
  { key: "GHS09", label: "Umweltgefährlich", src: ghs09 },
];

export const PSA_SYMBOLS: { key: string; label: string; src: string }[] = [
  { key: "goggles", label: "Schutzbrille", src: psaGoggles },
  { key: "gloves", label: "Schutzhandschuhe", src: psaGloves },
  { key: "mask", label: "Atemschutz / Mundschutz", src: psaMask },
  { key: "shoe", label: "Sicherheitsschuhe", src: psaShoe },
  { key: "clothing", label: "Schutzkleidung", src: psaClothing },
  { key: "face", label: "Gesichtsschutz", src: psaFace },
  { key: "ear", label: "Gehörschutz", src: psaEar },
  { key: "helmet", label: "Schutzhelm", src: psaHelmet },
  { key: "extraction", label: "Absaugung erforderlich", src: psaExtraction },
  { key: "hygiene", label: "Hygienemaßnahmen beachten", src: psaHygiene },
];

export function ghsByKey(k: string) { return GHS_SYMBOLS.find((g) => g.key === k); }
export function psaByKey(k: string) { return PSA_SYMBOLS.find((p) => p.key === k); }

/**
 * Map raw_material.hazard_categories values (e.g. "entzuendlich") to GHS keys.
 * Mirrors src/lib/hazardClasses.ts mapping.
 */
const HAZARD_TO_GHS: Record<string, string> = {
  explosionsgefaehrlich: "GHS01",
  entzuendlich: "GHS02",
  oxidierend: "GHS03",
  gas_unter_druck: "GHS04",
  aetzend: "GHS05",
  giftig: "GHS06",
  gefaehrlich: "GHS07",
  gesundheitsgefaehrdend: "GHS08",
  umweltgefaehrlich: "GHS09",
};

export function ghsKeysFromHazardCategories(cats: unknown): string[] {
  if (!Array.isArray(cats)) return [];
  return (cats as string[])
    .map((c) => HAZARD_TO_GHS[c] ?? (c.startsWith("GHS") ? c : null))
    .filter((v): v is string => !!v);
}
