import "server-only";

import { cache } from "react";

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
      return await caller.content.getById({ id });
    } catch {
      // `content.getById` throws for an id it cannot find, which is the
      // ordinary case for a mistyped or retired link rather than an error.
      return null;
    }
  },
);
