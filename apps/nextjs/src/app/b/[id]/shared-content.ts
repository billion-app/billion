import type { ReaderLanguage } from "~/app/_lib/reader-language";

import "server-only";

import { cache } from "react";
import { TRPCError } from "@trpc/server";

import type { RouterOutputs } from "@acme/api";
import { createCaller } from "@acme/api";
import { db } from "@acme/db/client";

import { auth } from "~/auth/server";
import { contentIdFromSegment } from "./share-copy";

export type SharedContent = RouterOutputs["content"]["getById"];

/**
 * The share page is public and identical for everyone, so it deliberately
 * builds a context with no session rather than going through
 * `createTRPCContext`. Resolving a session would add a database round trip to
 * every link preview — including the ones link scrapers fetch — to produce a
 * page that would look the same either way.
 */
const caller = createCaller({ authApi: auth.api, session: null, db });

/**
 * Content for a share URL, or `null` when the segment names nothing we have.
 *
 * `cache` matters here: the page and its `generateMetadata` both need the same
 * record within one request, and neither should pay for it twice.
 */
export const getSharedContent = cache(
  async (segment: string): Promise<SharedContent | null> => {
    const id = contentIdFromSegment(segment);
    if (!id) return null;

    try {
      return await caller.content.getById({ id, supportsMassachusetts: true });
    } catch (error) {
      // `content.getById` throws for an id it cannot find, which is the
      // ordinary case for a mistyped or retired link rather than an error.
      if (error instanceof TRPCError && error.code === "NOT_FOUND") return null;
      throw error;
    }
  },
);

/** Uses the same reviewed source and translation cache as the in-app reader. */
export async function getLocalizedSharedContent(
  segment: string,
  language: ReaderLanguage,
) {
  const content = await getSharedContent(segment);
  if (!content || language === "en") return { content, pending: false };
  const translated = await caller.content.getTranslation({
    id: content.id,
    language,
    sourceHash: content.translationSourceHash,
    supportsMassachusetts: true,
  });
  if (translated.status !== "translated")
    return { content: null, pending: true };
  return {
    pending: false,
    content: {
      ...content,
      title: translated.title,
      description: translated.description,
      articleContent: translated.articleContent ?? translated.description,
      ...("brief" in content ? { brief: translated.brief } : {}),
    } as SharedContent,
  };
}
