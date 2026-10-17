import assert from "node:assert/strict";
import test from "node:test";

import { DICTIONARIES, translate } from "./strings";

void test("reader labels have complete Chinese and Spanish translations with matching placeholders", () => {
  const placeholders = (value: string) =>
    [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const [key, english] of Object.entries(DICTIONARIES.en)) {
    if (!key.startsWith("readerUi.")) continue;
    for (const language of ["es", "zh"] as const) {
      const localized =
        DICTIONARIES[language][key as keyof typeof DICTIONARIES.en];
      assert.ok(localized, `${language}: ${key}`);
      assert.deepEqual(
        placeholders(localized),
        placeholders(english),
        `${language}: ${key}`,
      );
    }
  }
  assert.equal(translate("zh", "readerUi.shortVersion"), "简要说明");
  assert.equal(translate("es", "readerUi.type.bill"), "PROYECTO DE LEY");
});
