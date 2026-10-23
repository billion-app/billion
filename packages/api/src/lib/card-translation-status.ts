import { z } from "zod/v4";

import { and, eq, inArray, or, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { ContentTranslation } from "@acme/db/schema";

import { CARD_TRANSLATION_PROMPT_VERSION } from "./content-translation";

export const cardTranslationLookupSchema = z.object({
  contentId: z.uuid(),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  fields: z
    .array(z.enum(["card.title", "card.description", "card.featureTakeaway"]))
    .max(3),
});

export type CardTranslationLookup = z.infer<typeof cardTranslationLookupSchema>;

export async function readyCardTranslations(input: {
  language: "es" | "zh";
  lookups: CardTranslationLookup[];
}) {
  if (!input.lookups.length) return [];
  return db
    .select({
      contentId: ContentTranslation.contentId,
      sourceHash: ContentTranslation.sourceHash,
    })
    .from(ContentTranslation)
    .where(
      and(
        eq(ContentTranslation.language, input.language),
        sql`${ContentTranslation.modelVersion} like ${`${CARD_TRANSLATION_PROMPT_VERSION}:%`}`,
        inArray(ContentTranslation.contentType, [
          "bill",
          "government_content",
          "court_case",
        ]),
        or(
          ...input.lookups.map((lookup) =>
            and(
              eq(ContentTranslation.contentId, lookup.contentId),
              eq(ContentTranslation.sourceHash, lookup.sourceHash),
              ...lookup.fields.map(
                (field) =>
                  sql`(${ContentTranslation.payload}->>${field}) ~ '[^[:space:]]'`,
              ),
            ),
          ),
        ),
      ),
    );
}
