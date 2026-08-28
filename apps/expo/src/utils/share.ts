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
import {
  isInstagramStoryAvailable,
  shareToInstagramStory,
} from "../../modules/instagram-story/src";
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
 * Resolves to whether the native share UI accepted the request. iOS reports
 * whether the reader completed or dismissed it; Android does not expose that
 * distinction, so reaching the chooser is the strongest truthful signal.
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

    if (Platform.OS === "android") {
      posthog.capture("content_share_sheet_opened", {
        content_id: target.contentId,
        content_type: target.contentType,
        surface: target.surface,
        format: "link",
      });
      return true;
    }

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
 * Downloads the story-shaped image rendered by the web app. Keeping rendering
 * on the server means the card can be redesigned without an App Store release.
 */
async function downloadStoryImage(target: ShareTarget): Promise<File> {
  const base = baseUrl();
  if (!base) throw new Error("Share image URL is not configured");

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
  return destination;
}

async function openImageShareSheet(
  destination: File,
  target: ShareTarget,
): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;

  await Sharing.shareAsync(destination.uri, {
    mimeType: "image/png",
    UTI: "public.png",
    dialogTitle: "Share this brief",
  });

  // expo-sharing reports nothing about what the reader picked — or whether
  // they picked anything — so this counts reaching the sheet, not sending.
  posthog.capture("content_share_sheet_opened", {
    content_id: target.contentId,
    content_type: target.contentType,
    surface: target.surface,
    format: "story_image",
  });
  return true;
}

/** Whether this build and device support the direct Instagram handoff. */
export async function canShareToInstagramStory(): Promise<boolean> {
  return isInstagramStoryAvailable();
}

/** Shares the image through the system chooser, without assuming a destination. */
export async function shareContentImage(target: ShareTarget): Promise<boolean> {
  const canShareSheet = await Sharing.isAvailableAsync();

  if (!canShareSheet) {
    // No way to hand a file anywhere (web). The link is the next best thing
    // and is what the reader was trying to do anyway.
    return shareContentLink(target);
  }

  try {
    return openImageShareSheet(await downloadStoryImage(target), target);
  } catch (error) {
    posthog.captureException(error as Error, {
      content_id: target.contentId,
      surface: target.surface,
    });
    return false;
  }
}

/** Opens Instagram's story composer with the rendered card already placed. */
export async function shareContentToInstagramStory(
  target: ShareTarget,
): Promise<boolean> {
  if (!(await canShareToInstagramStory())) return shareContentImage(target);

  try {
    const destination = await downloadStoryImage(target);
    const handedOff = await shareToInstagramStory({
      fileUri: destination.uri,
      contentUrl: shareUrlFor(target.contentId, target.surface) ?? undefined,
    });

    if (handedOff) {
      posthog.capture("content_story_composer_opened", {
        content_id: target.contentId,
        content_type: target.contentType,
        surface: target.surface,
        destination: "instagram_stories",
      });
      return true;
    }

    return openImageShareSheet(destination, target);
  } catch (error) {
    posthog.captureException(error as Error, {
      content_id: target.contentId,
      surface: target.surface,
    });
    return false;
  }
}
