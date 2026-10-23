import type { AppStringKey } from "~/i18n/app-strings";
import type { AppLanguage } from "~/i18n/language";
import { translateApp } from "~/i18n/app-strings";

/**
 * Save is the existing device-local saved set. Storage keys and analytics
 * names stay as they are.
 */

export function followNoun(type: string | undefined): string {
  switch (type) {
    case "local_decision":
      return "decision";
    case "bill":
      return "bill";
    case "court_case":
    case "court":
      return "case";
    case "government_content":
    case "exec":
      return "order";
    default:
      return "record";
  }
}

const NOUN_KEYS: Record<string, { save: AppStringKey; remove: AppStringKey }> =
  {
    decision: { save: "follow.saveDecision", remove: "follow.removeDecision" },
    bill: { save: "follow.saveBill", remove: "follow.removeBill" },
    case: { save: "follow.saveCase", remove: "follow.removeCase" },
    order: { save: "follow.saveOrder", remove: "follow.removeOrder" },
    record: { save: "follow.saveRecord", remove: "follow.removeRecord" },
  };

export function followAccessibilityLabel(
  type: string | undefined,
  saved: boolean,
  title?: string,
  language: AppLanguage = "en",
): string {
  if (title) {
    return translateApp(
      language,
      saved ? "follow.removeTitle" : "follow.saveTitle",
      { title },
    );
  }
  const keys = NOUN_KEYS[followNoun(type)] ?? {
    save: "follow.saveRecord",
    remove: "follow.removeRecord",
  };
  return translateApp(language, saved ? keys.remove : keys.save);
}
