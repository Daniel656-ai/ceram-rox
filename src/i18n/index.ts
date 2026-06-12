import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import commonDe from "./locales/de/common.json";
import navigationDe from "./locales/de/navigation.json";
import authDe from "./locales/de/auth.json";
import ordersDe from "./locales/de/orders.json";
import projectsDe from "./locales/de/projects.json";
import samplesDe from "./locales/de/samples.json";
import measurementsDe from "./locales/de/measurements.json";
import rawMaterialsDe from "./locales/de/raw_materials.json";
import adminDe from "./locales/de/admin.json";
import calendarDe from "./locales/de/calendar.json";
import materialsDe from "./locales/de/materials.json";
import activityDe from "./locales/de/activity.json";
import hazardDe from "./locales/de/hazard.json";

import commonEn from "./locales/en/common.json";
import navigationEn from "./locales/en/navigation.json";
import authEn from "./locales/en/auth.json";
import ordersEn from "./locales/en/orders.json";
import projectsEn from "./locales/en/projects.json";
import samplesEn from "./locales/en/samples.json";
import measurementsEn from "./locales/en/measurements.json";
import rawMaterialsEn from "./locales/en/raw_materials.json";
import adminEn from "./locales/en/admin.json";
import calendarEn from "./locales/en/calendar.json";
import materialsEn from "./locales/en/materials.json";
import activityEn from "./locales/en/activity.json";
import hazardEn from "./locales/en/hazard.json";

const resources = {
  de: {
    common: commonDe,
    navigation: navigationDe,
    auth: authDe,
    orders: ordersDe,
    projects: projectsDe,
    samples: samplesDe,
    measurements: measurementsDe,
    raw_materials: rawMaterialsDe,
    admin: adminDe,
    calendar: calendarDe,
    materials: materialsDe,
    activity: activityDe,
    hazard: hazardDe,
  },
  en: {
    common: commonEn,
    navigation: navigationEn,
    auth: authEn,
    orders: ordersEn,
    projects: projectsEn,
    samples: samplesEn,
    measurements: measurementsEn,
    raw_materials: rawMaterialsEn,
    admin: adminEn,
    calendar: calendarEn,
    materials: materialsEn,
    activity: activityEn,
    hazard: hazardEn,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "de",
    defaultNS: "common",
    ns: ["common", "navigation", "auth", "orders", "projects", "samples", "measurements", "raw_materials", "admin", "calendar", "materials", "activity", "hazard"],
    interpolation: {
      escapeValue: false,
    },
    returnEmptyString: false,
    parseMissingKeyHandler: (key) => {
      if (import.meta.env.DEV) {
        console.warn(`[i18n] Missing translation key: ${key}`);
      }
      return key;
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "ceramrox_language",
      caches: ["localStorage"],
    },
  });

export default i18n;
