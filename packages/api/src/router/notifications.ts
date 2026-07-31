import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { PushDevice } from "@acme/db/schema";

import { publicProcedure } from "../trpc";

const ExpoPushTokenSchema = z
  .string()
  .regex(
    /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/,
    "Invalid Expo push token",
  );

export const notificationsRouter = {
  getSettings: publicProcedure
    .input(z.object({ expoPushToken: ExpoPushTokenSchema }))
    .query(async ({ input }) => {
      const [device] = await db
        .select({ breakingNews: PushDevice.breakingNews })
        .from(PushDevice)
        .where(eq(PushDevice.expoPushToken, input.expoPushToken))
        .limit(1);

      return { breakingNews: device?.breakingNews ?? false };
    }),

  registerDevice: publicProcedure
    .input(
      z.object({
        expoPushToken: ExpoPushTokenSchema,
        platform: z.enum(["ios", "android"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user.id;
      await db
        .insert(PushDevice)
        .values({
          userId,
          expoPushToken: input.expoPushToken,
          platform: input.platform,
          breakingNews: true,
        })
        .onConflictDoUpdate({
          target: PushDevice.expoPushToken,
          set: {
            ...(userId ? { userId } : {}),
            platform: input.platform,
            enabled: true,
            breakingNews: true,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          },
        });

      return { success: true };
    }),

  refreshDevice: publicProcedure
    .input(
      z.object({
        expoPushToken: ExpoPushTokenSchema,
        platform: z.enum(["ios", "android"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user.id;
      await db
        .insert(PushDevice)
        .values({
          userId,
          expoPushToken: input.expoPushToken,
          platform: input.platform,
        })
        .onConflictDoUpdate({
          target: PushDevice.expoPushToken,
          set: {
            ...(userId ? { userId } : {}),
            platform: input.platform,
            enabled: true,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          },
        });

      return { success: true };
    }),

  setBreakingNews: publicProcedure
    .input(
      z.object({
        expoPushToken: ExpoPushTokenSchema,
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await db
        .update(PushDevice)
        .set({
          breakingNews: input.enabled,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(PushDevice.expoPushToken, input.expoPushToken))
        .returning({ id: PushDevice.id });

      return { success: result.length > 0 };
    }),
} satisfies TRPCRouterRecord;
