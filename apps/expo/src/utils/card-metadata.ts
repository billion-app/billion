import type { AppLanguage } from "~/i18n/language";
import { translateApp } from "~/i18n/app-strings";

const metadataKeys = {
  Senate: "card.metadata.0",
  House: "card.metadata.1",
  Assembly: "card.metadata.2",
  Enacted: "card.metadata.3",
  Vetoed: "card.metadata.4",
  Failed: "card.metadata.5",
  Withdrawn: "card.metadata.6",
  "Agreed to by both chambers": "card.metadata.7",
  "Agreed to in House": "card.metadata.8",
  "Agreed to in Senate": "card.metadata.9",
  "Passed House": "card.metadata.10",
  "Passed Senate": "card.metadata.11",
  "Passed both chambers": "card.metadata.12",
  Passed: "card.metadata.13",
  "Presented to governor": "card.metadata.14",
  Enrolled: "card.metadata.15",
  "Passed committee": "card.metadata.16",
  Proposed: "card.metadata.17",
  "Referred to committee": "card.metadata.18",
  Introduced: "card.metadata.19",
  "Reported by committee": "card.metadata.20",
} as const;

export function translateCardMetadata(
  value: string | undefined,
  language: AppLanguage,
): string | undefined {
  if (!value) return value;
  if (!Object.hasOwn(metadataKeys, value)) return value;
  return translateApp(
    language,
    metadataKeys[value as keyof typeof metadataKeys],
  );
}

export function translateSessionLabel(
  value: string,
  language: AppLanguage,
): string {
  const regular = /^(.*?) regular session$/i.exec(value);
  if (regular?.[1])
    return translateApp(language, "session.regular", { years: regular[1] });
  if (value === "89th Legislature · 2nd called session")
    return translateApp(language, "session.texas89");
  return value;
}
