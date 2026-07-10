"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";

import { authClient } from "~/auth/client";

export function PostHogAuthTracker() {
  const { data: session } = authClient.useSession();
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const userId = session?.user.id ?? null;

    if (userId && userId !== prevUserIdRef.current) {
      posthog.identify(userId, {
        name: session?.user.name,
        email: session?.user.email,
        image: session?.user.image,
      });
    } else if (!userId && prevUserIdRef.current) {
      posthog.reset();
    }

    prevUserIdRef.current = userId;
  }, [session]);

  return null;
}
