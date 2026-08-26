import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

/**
 * Instagram Stories handoff.
 *
 * Instagram's documented route is a pasteboard write under its own
 * `com.instagram.sharedSticker.*` keys followed by opening
 * `instagram-stories://share`. Those are custom pasteboard types, so this
 * cannot be done from JavaScript — hence the native module next door.
 *
 * Optional at load: the module is Apple-only, and resolving it eagerly would
 * make Android and web throw on import rather than simply report that direct
 * sharing is unavailable.
 */
interface InstagramStoryNativeModule {
  isAvailableAsync: () => Promise<boolean>;
  shareAsync: (
    fileUri: string,
    appId: string | null,
    contentUrl: string | null,
  ) => Promise<boolean>;
}

const native =
  requireOptionalNativeModule<InstagramStoryNativeModule>("InstagramStory");

/** Whether this device can take a story directly — iOS, with Instagram installed. */
export async function isInstagramStoryAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios" || !native) return false;
  try {
    return await native.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Opens Instagram's story composer with `fileUri` already placed.
 *
 * Resolves `false` rather than throwing when the handoff cannot be made, so
 * callers can fall through to the share sheet without treating an ordinary
 * "Instagram isn't installed" as an error.
 */
export async function shareToInstagramStory(options: {
  fileUri: string;
  /** Facebook app id Instagram attributes the share to, when there is one. */
  appId?: string;
  /** Link carried alongside the sticker, for accounts allowed to attach one. */
  contentUrl?: string;
}): Promise<boolean> {
  if (Platform.OS !== "ios" || !native) return false;
  try {
    return await native.shareAsync(
      options.fileUri,
      options.appId ?? null,
      options.contentUrl ?? null,
    );
  } catch {
    return false;
  }
}
