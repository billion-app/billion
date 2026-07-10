"use client";

import posthog from "posthog-js";

import { Button } from "@acme/ui/button";

export function DiscordSignInButton({
  formAction,
}: {
  formAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <Button
      size="lg"
      formAction={formAction}
      onClick={() => posthog.capture("discord_sign_in_clicked")}
    >
      Sign in with Discord
    </Button>
  );
}

export function SignOutButton({
  formAction,
}: {
  formAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <Button
      size="lg"
      formAction={formAction}
      onClick={() => posthog.capture("user_signed_out")}
    >
      Sign out
    </Button>
  );
}
