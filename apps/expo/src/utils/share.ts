/**
 * Sharing a record out of the app.
 *
 * Every outbound share points at the web preview (`/b/<id>`) rather than at
 * the App Store. A link that opens something readable is worth forwarding; a
 * link that opens an install prompt is not, and the preview carries the
 * install ask anyway. UTMs are attached here so the referral can be traced
 * back to the surface the reader shared from.
 */
import { Platform, Share } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { posthog } from "~/config/posthog";
import { getBaseUrl } from "./base-url";

/** Where in the app a share started, so the surfaces can be told apart. */
export type ShareSurface = "article_header" | "screenshot";

interface ShareTarget {
  contentId: string;
  contentType: string;
  title: string;
  surface: ShareSurface;
}

/**
 * `getBaseUrl` throws when it cannot work out where the API lives, which is a
 * development misconfiguration rather than something a reader should see as a
 * crash mid-share.
 */
function baseUrl(): string | null {
  try {
    return getBaseUrl().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** The public URL for a record, tagged with where the share came from. */
export function shareUrlFor(
  contentId: string,
  surface: ShareSurface,
): string | null {
  const base = baseUrl();
  if (!base) return null;

  // Built by hand: `URLSearchParams` is a partial polyfill on React Native,
  // and three known-safe parameters are not worth depending on it for.
  const params = [
    "utm_source=app",
    "utm_medium=share",
    `utm_campaign=${encodeURIComponent(surface)}`,
  ].join("&");
  return `${base}/b/${encodeURIComponent(contentId)}?${params}`;
}

/**
 * The system share sheet, on the link.
 *
 * Resolves to whether the reader actually sent it, so callers can dismiss
 * their own UI on success and leave it up if the reader backed out.
 */
export async function shareContentLink(target: ShareTarget): Promise<boolean> {
  const url = shareUrlFor(target.contentId, target.surface);
  if (!url) return false;

  try {
    const result = await Share.share(
      // iOS renders `url` as the rich link and `message` as the accompanying
      // text. Android has no separate URL field, so it has to go in the body
      // or it is simply dropped.
      Platform.OS === "ios"
        ? { message: target.title, url }
        : { message: `${target.title}\n\n${url}` },
    );

    const shared = result.action === Share.sharedAction;
    posthog.capture(shared ? "content_shared" : "content_share_dismissed", {
      content_id: target.contentId,
      content_type: target.contentType,
      surface: target.surface,
      format: "link",
    });
    return shared;
  } catch (error) {
    posthog.captureException(error as Error, {
      content_id: target.contentId,
      surface: target.surface,
    });
    return false;
  }
}

/**
 * The system share sheet, on a story-shaped image of the record.
 *
 * There is no supported way to hand an image straight to Instagram Stories
 * without a custom native module and a pasteboard write, so this opens the
 * share sheet on the file instead: Instagram appears there and offers "Add to
 * story", as does every other app the reader might post to.
 *
 * The image is rendered by the web app rather than the phone, so the card can
 * be redesigned without an App Store release.
 */
export async function shareContentStory(target: ShareTarget): Promise<boolean> {
  const base = baseUrl();
  if (!base) return false;

  if (!(await Sharing.isAvailableAsync())) {
    // No share sheet on this platform (web). The link is the next best thing
    // and is what the reader was trying to do anyway.
    return shareContentLink(target);
  }

  try {
    // `Paths.cache` always exists, so the download needs no directory setup,
    // and the OS reclaims the file when it needs the space. The name is fixed
    // per record so a re-share overwrites rather than accumulating.
    const destination = new File(
      Paths.cache,
      `billion-story-${target.contentId}.png`,
    );
    await File.downloadFileAsync(
      `${base}/b/${target.contentId}/story`,
      destination,
      { idempotent: true },
    );

    await Sharing.shareAsync(destination.uri, {
      mimeType: "image/png",
      UTI: "public.png",
      dialogTitle: "Share this brief",
    });

    // The share sheet reports nothing about what the reader picked — or
    // whether they picked anything — so this counts reaching it, not sending.
    posthog.capture("content_share_sheet_opened", {
      content_id: target.contentId,
      content_type: target.contentType,
      surface: target.surface,
      format: "story_image",
    });
    return true;
  } catch (error) {
    posthog.captureException(error as Error, {
      content_id: target.contentId,
      surface: target.surface,
    });
    return false;
  }
}
