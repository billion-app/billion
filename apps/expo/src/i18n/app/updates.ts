import type { Catalog } from "./types";

export const updateStrings = {
  "readerAudit.openFailed": {
    en: "Could not open this reader. Please try again.",
    es: "No se pudo abrir este lector. Inténtalo de nuevo.",
    zh: "无法打开阅读器，请重试。",
  },
  "storeUpdate.failedTitle": {
    en: "Unable to open App Store",
    es: "No se pudo abrir el App Store",
    zh: "无法打开 App Store",
  },
  "storeUpdate.failedBody": {
    en: "Please try again, or search for Billion in the App Store.",
    es: "Inténtalo de nuevo o busca Billion en el App Store.",
    zh: "请重试，或在 App Store 中搜索 Billion。",
  },
  "storeUpdate.title": {
    en: "An update is here",
    es: "Hay una actualización",
    zh: "有新版本可用",
  },
  "storeUpdate.version": {
    en: "Billion {version} · App Store",
    es: "Billion {version} · App Store",
    zh: "Billion {version} · App Store",
  },
  "storeUpdate.open": {
    en: "Open App Store",
    es: "Abrir App Store",
    zh: "打开 App Store",
  },
  "storeUpdate.openA11y": {
    en: "Open Billion in the App Store",
    es: "Abrir Billion en el App Store",
    zh: "在 App Store 中打开 Billion",
  },
  "storeUpdate.later": { en: "Later", es: "Más tarde", zh: "稍后" },
  "storeUpdate.dismissA11y": {
    en: "Dismiss App Store update for this session",
    es: "Ocultar la actualización del App Store durante esta sesión",
    zh: "在本次使用期间隐藏 App Store 更新提示",
  },
} satisfies Catalog;
