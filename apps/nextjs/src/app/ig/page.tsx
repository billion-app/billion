import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { env } from "~/env";
import { AndroidIcon } from "../_components/icons";
import { WaitlistForm } from "../_components/waitlist-form";
import { APP_STORE_URL } from "../_lib/app-store";
import { isAndroidUserAgent } from "../_lib/platform";
import { campaignFor } from "../r/campaigns";

const INSTAGRAM_CAMPAIGN = campaignFor("instagram_bio");

export const metadata: Metadata = {
  title: "Billion for Android — Coming Soon",
  description:
    "Billion is on iOS today and coming to Android. Join the mailing list to hear when it lands.",
  robots: { index: false, follow: false },
};

/**
 * Stable Instagram-bio entry point.
 *
 * The bio link is printed in one place and read on whatever phone someone
 * happens to be holding, so the branch has to happen here: iPhone (and
 * desktop, where the App Store page still works) goes straight to the store,
 * and Android — where there is nothing to install yet — gets told so and is
 * offered the mailing list instead of a dead end.
 */
export default async function InstagramLandingPage() {
  const isAndroid = isAndroidUserAgent((await headers()).get("user-agent"));

  await captureVisit(isAndroid ? "android" : "app_store");

  if (!isAndroid) redirect(APP_STORE_URL);

  const homeHref = `/?${new URLSearchParams(INSTAGRAM_CAMPAIGN).toString()}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-[560px] flex-col items-center justify-center px-6 py-16 text-center">
      <Image
        src="/billion-logo.png"
        alt=""
        width={64}
        height={64}
        className="mb-8 h-16 w-16 rounded-[14px]"
      />

      <div className="text-muted-foreground mb-6 flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 font-sans text-[13px] font-medium">
        <AndroidIcon className="h-4 w-4 shrink-0 text-emerald-400" />
        <span>Coming Soon to Android</span>
      </div>

      <h1
        className="text-foreground font-display mb-4 leading-[1.15] font-bold tracking-[-0.02em]"
        style={{ fontSize: "clamp(2rem, 7vw, 2.75rem)" }}
      >
        Billion isn&apos;t on Android yet.
      </h1>
      <p className="text-muted-foreground mb-8 font-sans text-[17px] leading-[1.6]">
        We&apos;re building it. Leave your email and we&apos;ll tell you the day
        it&apos;s ready, and you can leave any time.
      </p>

      <div className="w-full">
        <WaitlistForm buttonText="Notify me" />
      </div>

      <Link
        href={homeHref}
        className="text-muted-foreground hover:text-accent mt-10 font-sans text-[15px] font-medium no-underline transition-colors duration-200"
      >
        See what Billion does →
      </Link>
    </main>
  );
}

/**
 * Instagram referrers do not survive its in-app browser, and the App Store hop
 * leaves no UTMs behind on our side, so the visit is counted here or nowhere.
 * Never allowed to fail the page: a broken analytics host must not cost us the
 * install.
 */
async function captureVisit(outcome: "android" | "app_store") {
  const key: string | undefined = env.NEXT_PUBLIC_POSTHOG_KEY;
  const host: string | undefined = env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key || !host) return;

  try {
    await fetch(`${host.replace(/\/$/, "")}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(1500),
      body: JSON.stringify({
        api_key: key,
        event: "instagram_bio_visit",
        properties: {
          // Counted, not followed — same reasoning as the /r redirect.
          distinct_id: `ig-${crypto.randomUUID()}`,
          $process_person_profile: false,
          ...INSTAGRAM_CAMPAIGN,
          outcome,
        },
      }),
    });
  } catch {
    // Swallowed on purpose — see above.
  }
}
