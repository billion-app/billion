import type { BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { oAuthProxy } from "better-auth/plugins";

import { db } from "@acme/db/client";

function expoPlugin(options?: { disableOriginOverride?: boolean }) {
  return {
    id: "expo",
    init: () => {
      return {
        options: {
          trustedOrigins: process.env.NODE_ENV === "development" ? ["exp://"] : [],
        },
      };
    },
    async onRequest(request: Request) {
      if (options?.disableOriginOverride || request.headers.get("origin")) return;

      // Expo native clients send their origin separately, so mirror it for Better Auth's origin check.
      const expoOrigin = request.headers.get("expo-origin");
      if (!expoOrigin) return;

      try {
        request.headers.set("origin", expoOrigin);
        return { request };
      } catch {
        const newHeaders = new Headers(request.headers);
        newHeaders.set("origin", expoOrigin);
        return { request: new Request(request, { headers: newHeaders }) };
      }
    },
    hooks: {
      after: [
        {
          matcher(context: { path?: string | null }) {
            return !!(
              context.path?.startsWith("/callback") ||
              context.path?.startsWith("/oauth2/callback") ||
              context.path?.startsWith("/magic-link/verify") ||
              context.path?.startsWith("/verify-email")
            );
          },
          handler: createAuthMiddleware(async (ctx) => {
            const headers = ctx.context.responseHeaders;
            const location = headers?.get("location");
            if (!location || location.includes("/oauth-proxy-callback")) return;

            let redirectURL: URL;
            try {
              redirectURL = new URL(location);
            } catch {
              return;
            }

            if (
              redirectURL.protocol === "http:" ||
              redirectURL.protocol === "https:" ||
              !ctx.context.isTrustedOrigin(location)
            ) {
              return;
            }

            const cookie = headers?.get("set-cookie");
            if (!cookie) return;

            redirectURL.searchParams.set("cookie", cookie);
            ctx.setHeader("location", redirectURL.toString());
          }),
        },
      ],
    },
    options,
  };
}

export function initAuth(options: {
  baseUrl: string;
  productionUrl: string;
  secret: string | undefined;

  discordClientId: string | undefined;
  discordClientSecret: string | undefined;
}) {
  const config = {
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    baseURL: options.baseUrl,
    secret: options.secret,
    plugins: [
      oAuthProxy({
        productionURL: options.productionUrl,
      }),
      expoPlugin(),
    ],
    socialProviders: {
      ...(options.discordClientId && options.discordClientSecret
        ? {
            discord: {
              clientId: options.discordClientId,
              clientSecret: options.discordClientSecret,
              redirectURI: `${options.productionUrl}/api/auth/callback/discord`,
            },
          }
        : {}),
    },
    trustedOrigins: ["expo://"],
    onAPIError: {
      onError(error, ctx) {
        console.error("BETTER AUTH API ERROR", error, ctx);
      },
    },
  } satisfies BetterAuthOptions;

  return betterAuth(config);
}

export type Auth = ReturnType<typeof initAuth>;
export type Session = Auth["$Infer"]["Session"];
