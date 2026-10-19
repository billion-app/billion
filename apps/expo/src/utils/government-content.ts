import { getGovernmentContentLabel } from "@acme/ui/digest-tokens";

import type { AppLanguage } from "~/i18n/language";
import { translateApp } from "~/i18n/app-strings";

export function governmentContentLabel(
  governmentContentType: string | undefined,
  language: AppLanguage,
) {
  return translateApp(
    language,
    `governmentContent.${getGovernmentContentLabel(governmentContentType)}`,
  );
}
