import "server-only";

import { cache } from "react";
import { TRPCError } from "@trpc/server";

import type { RouterOutputs } from "@acme/api";
import { createCaller } from "@acme/api";
import { db } from "@acme/db/client";

import { auth } from "~/auth/server";

export type ReaderContent = RouterOutputs["content"]["getById"];

/**
 * The reader is public and the same for everyone, so — like the share page —
 * it builds a session-less caller instead of resolving a session per request.
 * Personal state (saves) lives in the browser, not in this render.
 */
const caller = createCaller({ authApi: auth.api, session: null, db });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The record, or `null` when the id names nothing — which the page turns into a 404. */
export const getReaderContent = cache(
  async (id: string): Promise<ReaderContent | null> => {
    if (!UUID.test(id)) return null;
    try {
      return await caller.content.getById({ id });
    } catch (error) {
      if (error instanceof TRPCError && error.code === "NOT_FOUND") return null;
      throw error;
    }
  },
);
