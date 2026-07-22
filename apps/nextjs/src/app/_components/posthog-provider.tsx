"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

import { env } from "~/env";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
      defaults: "2026-05-30",
    });
  }, []);

  return <>{children}</>;
}
